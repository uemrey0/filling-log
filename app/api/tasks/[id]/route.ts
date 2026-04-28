import { NextRequest } from 'next/server'
import { db, withTransaction } from '@/lib/db'
import { tasks, taskSessions, personnel, personnelRatings } from '@/lib/db/schema'
import {
  calcExpectedMinutes,
  calcTaskProjectedExpectedMinutes,
  calcExpectedMinutesForSession,
  calcActualMinutesNet,
  roundToOne,
  todayDate,
} from '@/lib/business'
import { eq, and, isNull, inArray, isNotNull } from 'drizzle-orm'
import { refreshPersonnelDailyStats, refreshDepartmentDailyStats } from '@/lib/analytics-refresh'
import { DEPARTMENT_KEYS, type DepartmentKey } from '@/lib/departments'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'
import type { ClientBase } from 'pg'
import type { NodePgClient } from 'drizzle-orm/node-postgres'

const editTaskSchema = z.object({
  department: z.enum([...DEPARTMENT_KEYS] as [DepartmentKey, ...DepartmentKey[]]).optional(),
  discountContainer: z.boolean().optional(),
  colliCount: z.number().int().min(1).max(9999).optional(),
  notes: z.string().max(500).nullable().optional(),
  personnelIds: z.array(z.string().uuid()).min(1).optional(),
  startedAt: z.string().datetime().optional(),
})

function toLocalDateIso(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 10)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
    if (!task) return Response.json({ error: 'Not found' }, { status: 404 })

    const sessions = await db
      .select({
        id: taskSessions.id,
        personnelId: taskSessions.personnelId,
        personnelName: personnel.fullName,
        startedAt: taskSessions.startedAt,
        endedAt: taskSessions.endedAt,
        totalPausedMinutes: taskSessions.totalPausedMinutes,
        workDate: taskSessions.workDate,
      })
      .from(taskSessions)
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
      .where(eq(taskSessions.taskId, id))

    const summary = calcTaskProjectedExpectedMinutes(
      task.colliCount,
      sessions.map((s) => s.startedAt),
      task.discountContainer,
    )

    const enrichedSessions = sessions.map((session) => {
      const expectedSessionMinutes = calcExpectedMinutesForSession(
        summary?.projectedExpectedMinutes ?? task.expectedMinutes,
        summary?.taskStartedAtMs ?? session.startedAt,
        session.startedAt,
      )
      const actualMinutes = calcActualMinutesNet(
        session.startedAt,
        session.endedAt,
        Number(session.totalPausedMinutes ?? 0),
      )
      const performanceDiff = actualMinutes !== null
        ? roundToOne(actualMinutes - expectedSessionMinutes)
        : null

      return {
        ...session,
        expectedSessionMinutes,
        actualMinutes,
        performanceDiff,
      }
    })

    const ratings = await db
      .select({
        personnelId: personnelRatings.personnelId,
        personnelName: personnel.fullName,
        workEthicScore: personnelRatings.workEthicScore,
        qualityScore: personnelRatings.qualityScore,
        teamworkScore: personnelRatings.teamworkScore,
        comment: personnelRatings.comment,
      })
      .from(personnelRatings)
      .innerJoin(personnel, eq(personnelRatings.personnelId, personnel.id))
      .where(and(eq(personnelRatings.taskId, id), isNotNull(personnelRatings.taskId)))

    return Response.json({ ...task, sessions: enrichedSessions, ratings })
  } catch {
    return Response.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = editTaskSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id))
    if (!existing) return Response.json({ error: 'Task not found', code: 'TASK_NOT_FOUND' }, { status: 404 })

    const wantsDepartment = parsed.data.department !== undefined
    const wantsDiscountContainer = parsed.data.discountContainer !== undefined
    const wantsColliCount = parsed.data.colliCount !== undefined
    const wantsPersonnelIds = parsed.data.personnelIds !== undefined
    const wantsStartedAt = parsed.data.startedAt !== undefined
    const wantsCompletedForbiddenField =
      wantsDepartment || wantsDiscountContainer || wantsColliCount || wantsPersonnelIds || wantsStartedAt

    const newColliCount = wantsColliCount ? parsed.data.colliCount! : existing.colliCount
    const newDepartment = wantsDepartment ? parsed.data.department! : existing.department
    const newDiscountContainer = wantsDiscountContainer
      ? parsed.data.discountContainer!
      : existing.discountContainer

    const now = new Date()
    const desiredPersonnelIds = wantsPersonnelIds
      ? Array.from(new Set(parsed.data.personnelIds))
      : null
    const startedAt = wantsStartedAt && parsed.data.startedAt ? new Date(parsed.data.startedAt) : null
    const startedAtWorkDate = startedAt ? toLocalDateIso(startedAt) : null

    const updated = await withTransaction(async (client: ClientBase) => {
      const txDb = drizzle(client as unknown as NodePgClient, { schema })

      const activeSessions = await txDb
        .select({
          id: taskSessions.id,
          personnelId: taskSessions.personnelId,
          startedAt: taskSessions.startedAt,
          workDate: taskSessions.workDate,
        })
        .from(taskSessions)
        .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

      const isCompletedTask = activeSessions.length === 0
      if (isCompletedTask && wantsCompletedForbiddenField) {
        throw new Error('Only notes and end times can be edited for completed task')
      }

      if (desiredPersonnelIds && activeSessions.length > 0) {
        const currentIds = new Set(activeSessions.map((s) => s.personnelId))
        const desiredIds = new Set(desiredPersonnelIds)

        const removeIds = Array.from(currentIds).filter((personnelId) => !desiredIds.has(personnelId))
        const addIds = Array.from(desiredIds).filter((personnelId) => !currentIds.has(personnelId))

        if (removeIds.length > 0) {
          await txDb
            .delete(taskSessions)
            .where(
              and(
                eq(taskSessions.taskId, id),
                isNull(taskSessions.endedAt),
                inArray(taskSessions.personnelId, removeIds),
              ),
            )
        }

        if (addIds.length > 0) {
          const fallbackStart = startedAt ?? activeSessions[0]?.startedAt ?? now
          const fallbackWorkDate = startedAtWorkDate ?? activeSessions[0]?.workDate ?? todayDate()
          await txDb
            .insert(taskSessions)
            .values(
              addIds.map((personnelId) => ({
                taskId: id,
                personnelId,
                startedAt: fallbackStart,
                workDate: fallbackWorkDate,
              })),
            )
        }
      }

      if (startedAt) {
        await txDb
          .update(taskSessions)
          .set({
            startedAt,
            workDate: startedAtWorkDate ?? todayDate(),
            updatedAt: now,
          })
          .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))
      }

      let newExpectedMinutes = existing.expectedMinutes
      if (activeSessions.length > 0 && (wantsColliCount || wantsPersonnelIds || wantsDiscountContainer)) {
        const refreshedActiveSessions = await txDb
          .select({ personnelId: taskSessions.personnelId })
          .from(taskSessions)
          .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

        const personnelCount = Math.max(
          desiredPersonnelIds?.length ?? refreshedActiveSessions.length,
          1,
        )
        newExpectedMinutes = calcExpectedMinutes(
          newColliCount,
          personnelCount,
          newDiscountContainer,
        )
      }

      const taskUpdates: Partial<typeof tasks.$inferInsert> = {
        updatedAt: now,
      }
      if (wantsDepartment) taskUpdates.department = newDepartment
      if (wantsDiscountContainer) taskUpdates.discountContainer = newDiscountContainer
      if (wantsColliCount) taskUpdates.colliCount = newColliCount
      if (activeSessions.length > 0 && (wantsColliCount || wantsPersonnelIds || wantsDiscountContainer)) {
        taskUpdates.expectedMinutes = newExpectedMinutes
      }
      if (parsed.data.notes !== undefined) {
        taskUpdates.notes = parsed.data.notes ?? null
      }

      const [taskUpdated] = await txDb
        .update(tasks)
        .set(taskUpdates)
        .where(eq(tasks.id, id))
        .returning()

      return taskUpdated
    })

    return Response.json(updated)
  } catch (err) {
    console.error('[PUT /api/tasks/[id]]', err)
    if (err instanceof Error && err.message === 'Only notes and end times can be edited for completed task') {
      return Response.json(
        { error: 'Only notes and end times can be edited for completed task', code: 'TASK_COMPLETED_EDIT_FORBIDDEN' },
        { status: 409 },
      )
    }
    return Response.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Collect sessions before cascade delete so we can refresh stats afterward
    const affectedSessions = await db
      .select({
        personnelId: taskSessions.personnelId,
        workDate: taskSessions.workDate,
        department: tasks.department,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(and(eq(taskSessions.taskId, id), isNotNull(taskSessions.endedAt)))

    const [deleted] = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning()

    if (!deleted) return Response.json({ error: 'Task not found', code: 'TASK_NOT_FOUND' }, { status: 404 })

    const personnelKeys = affectedSessions.map((s) => ({ personnelId: s.personnelId, workDate: String(s.workDate).slice(0, 10) }))
    const deptKeys = affectedSessions.map((s) => ({ workDate: String(s.workDate).slice(0, 10), department: s.department }))
    void refreshPersonnelDailyStats(personnelKeys).catch(console.error)
    void refreshDepartmentDailyStats(deptKeys).catch(console.error)

    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/tasks/[id]]', err)
    return Response.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}

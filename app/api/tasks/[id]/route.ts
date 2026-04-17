import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { calcExpectedMinutes } from '@/lib/business'
import { eq, sql, and, isNull } from 'drizzle-orm'
import { DEPARTMENT_KEYS, type DepartmentKey } from '@/lib/departments'
import { z } from 'zod'

const editTaskSchema = z.object({
  department: z.enum([...DEPARTMENT_KEYS] as [DepartmentKey, ...DepartmentKey[]]).optional(),
  colliCount: z.number().int().min(1).max(9999).optional(),
  notes: z.string().max(500).nullable().optional(),
})

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
        workDate: taskSessions.workDate,
        actualMinutes: sql<number | null>`
          CASE WHEN ${taskSessions.endedAt} IS NOT NULL
          THEN ROUND((
            EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60
            - COALESCE(${taskSessions.totalPausedMinutes}, 0)
          )::numeric, 1)
          ELSE NULL END`,
        performanceDiff: sql<number | null>`
          CASE WHEN ${taskSessions.endedAt} IS NOT NULL
          THEN ROUND((
            EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60
            - COALESCE(${taskSessions.totalPausedMinutes}, 0)
            - ${task.expectedMinutes}
          )::numeric, 1)
          ELSE NULL END`,
      })
      .from(taskSessions)
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
      .where(eq(taskSessions.taskId, id))

    return Response.json({ ...task, sessions })
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
      return Response.json({ error: 'Invalid input' }, { status: 400 })
    }

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id))
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

    const newColliCount = parsed.data.colliCount ?? existing.colliCount
    const newDepartment = parsed.data.department ?? existing.department

    const activeSessions = await db
      .select({ personnelId: taskSessions.personnelId })
      .from(taskSessions)
      .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

    const personnelCount = Math.max(activeSessions.length, 1)
    const newExpectedMinutes = calcExpectedMinutes(newColliCount, personnelCount)

    const [updated] = await db
      .update(tasks)
      .set({
        department: newDepartment,
        colliCount: newColliCount,
        expectedMinutes: newExpectedMinutes,
        notes: parsed.data.notes !== undefined ? (parsed.data.notes ?? null) : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning()

    return Response.json(updated)
  } catch (err) {
    console.error('[PUT /api/tasks/[id]]', err)
    return Response.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // task_sessions has ON DELETE CASCADE, so deleting the task removes sessions too
    const [deleted] = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning()

    if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/tasks/[id]]', err)
    return Response.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}

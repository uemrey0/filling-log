import { NextRequest } from 'next/server'
import { db, withTransaction } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { startTaskSchema } from '@/lib/validations'
import { calcExpectedMinutes, todayDate } from '@/lib/business'
import { eq, desc, isNull, sql, and, gte, lte, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'
import type { ClientBase, PoolClient } from 'pg'
import type { NodePgClient } from 'drizzle-orm/node-postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const personnelId = searchParams.get('personnelId')
    const department = searchParams.get('department')
    const activeOnly = searchParams.get('active') === 'true'
    const today = searchParams.get('today') === 'true'

    const sessionsQuery = db
      .select({
        sessionId: taskSessions.id,
        taskId: tasks.id,
        department: tasks.department,
        colliCount: tasks.colliCount,
        expectedMinutes: tasks.expectedMinutes,
        taskNotes: tasks.notes,
        personnelId: taskSessions.personnelId,
        personnelName: personnel.fullName,
        startedAt: taskSessions.startedAt,
        endedAt: taskSessions.endedAt,
        isPaused: taskSessions.isPaused,
        pausedSince: taskSessions.pausedSince,
        totalPausedMinutes: taskSessions.totalPausedMinutes,
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
            - ${tasks.expectedMinutes}
          )::numeric, 1)
          ELSE NULL END`,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))

    const conditions = []
    if (today) {
      conditions.push(eq(taskSessions.workDate, todayDate()))
    } else {
      if (dateFrom) conditions.push(gte(taskSessions.workDate, dateFrom))
      if (dateTo) conditions.push(lte(taskSessions.workDate, dateTo))
    }
    if (personnelId) conditions.push(eq(taskSessions.personnelId, personnelId))
    if (department) conditions.push(eq(tasks.department, department))
    if (activeOnly) conditions.push(isNull(taskSessions.endedAt))

    const rows =
      conditions.length > 0
        ? await sessionsQuery.where(and(...conditions)).orderBy(desc(taskSessions.startedAt))
        : await sessionsQuery.orderBy(desc(taskSessions.startedAt))

    return Response.json(rows)
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return Response.json({ error: 'Failed to fetch tasks', detail: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = startTaskSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { personnelIds, department, colliCount, notes, resolutions } = parsed.data
    const expectedMinutes = calcExpectedMinutes(colliCount, personnelIds.length)
    const now = new Date()
    const workDate = todayDate()

    const result = await withTransaction(async (client: ClientBase) => {
      const txDb = drizzle(client as unknown as NodePgClient, { schema })

      // Handle each conflict resolution (one per task)
      for (const res of resolutions) {
        if (res.isDone) {
          // End all active sessions for this task
          await txDb
            .update(taskSessions)
            .set({ endedAt: now, updatedAt: now })
            .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))
        } else {
          const remainingColli = res.remainingColli ?? 0

          // Find personnel on this task who are NOT switching to the new task
          const otherActiveSessions = await txDb
            .select({ personnelId: taskSessions.personnelId })
            .from(taskSessions)
            .where(
              and(
                eq(taskSessions.taskId, res.taskId),
                isNull(taskSessions.endedAt),
                sql`${taskSessions.personnelId} NOT IN (${sql.join(
                  personnelIds.map((id) => sql`${id}::uuid`),
                  sql`, `,
                )})`,
              ),
            )

          const [originalTask] = await txDb
            .select()
            .from(tasks)
            .where(eq(tasks.id, res.taskId))

          if (originalTask) {
            const doneColli = Math.max(1, originalTask.colliCount - remainingColli)

            await txDb
              .update(tasks)
              .set({ colliCount: doneColli, expectedMinutes: calcExpectedMinutes(doneColli, 1), updatedAt: now })
              .where(eq(tasks.id, res.taskId))

            // End all active sessions for the original task
            await txDb
              .update(taskSessions)
              .set({ endedAt: now, updatedAt: now })
              .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))

            // Create a continuation task for personnel who are NOT joining the new task
            if (otherActiveSessions.length > 0 && remainingColli > 0) {
              const [continuationTask] = await txDb
                .insert(tasks)
                .values({
                  department: originalTask.department,
                  colliCount: remainingColli,
                  expectedMinutes: calcExpectedMinutes(remainingColli, otherActiveSessions.length),
                  notes: originalTask.notes,
                })
                .returning()

              for (const other of otherActiveSessions) {
                await txDb.insert(taskSessions).values({
                  taskId: continuationTask.id,
                  personnelId: other.personnelId,
                  startedAt: now,
                  workDate,
                })
              }
            }
          }
        }
      }

      // Safety net: close any remaining active sessions for the new task's personnel
      await txDb
        .update(taskSessions)
        .set({ endedAt: now, updatedAt: now })
        .where(and(inArray(taskSessions.personnelId, personnelIds), isNull(taskSessions.endedAt)))

      // Create the new task
      const [task] = await txDb
        .insert(tasks)
        .values({ department, colliCount, expectedMinutes, notes: notes ?? null })
        .returning()

      const newSessions = await txDb
        .insert(taskSessions)
        .values(personnelIds.map((personnelId) => ({ taskId: task.id, personnelId, startedAt: now, workDate })))
        .returning()

      return { task, sessions: newSessions }
    })

    return Response.json(result, { status: 201 })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to start task' }, { status: 500 })
  }
}

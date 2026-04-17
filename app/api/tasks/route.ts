import { NextRequest } from 'next/server'
import { db, pool } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { startTaskSchema } from '@/lib/validations'
import { calcExpectedMinutes, todayDate } from '@/lib/business'
import { eq, desc, isNull, sql, and, gte, lte, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'

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
        workDate: taskSessions.workDate,
        actualMinutes: sql<number | null>`
          CASE WHEN ${taskSessions.endedAt} IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60, 1)
          ELSE NULL END`,
        performanceDiff: sql<number | null>`
          CASE WHEN ${taskSessions.endedAt} IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${tasks.expectedMinutes}, 1)
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
  } catch {
    return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect()
  try {
    const body = await request.json()
    const parsed = startTaskSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { personnelIds, department, colliCount, notes, resolutions } = parsed.data
    const expectedMinutes = calcExpectedMinutes(colliCount)
    const now = new Date()
    const workDate = todayDate()

    const txDb = drizzle(client, { schema })
    await client.query('BEGIN')

    // Handle each conflict resolution
    for (const res of resolutions) {
      if (res.isDone) {
        // Close ALL sessions on this task
        await txDb
          .update(taskSessions)
          .set({ endedAt: now, updatedAt: now })
          .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))
      } else {
        // Partial completion: split the task
        const remainingColli = res.remainingColli ?? 0

        // Find other active personnel on this task (excluding the person being reassigned)
        const otherActiveSessions = await txDb
          .select({ personnelId: taskSessions.personnelId })
          .from(taskSessions)
          .where(
            and(
              eq(taskSessions.taskId, res.taskId),
              isNull(taskSessions.endedAt),
              // exclude personnel being reassigned right now
              sql`${taskSessions.personnelId} NOT IN (${sql.join(personnelIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
            ),
          )

        // Get original task for department/notes
        const [originalTask] = await txDb
          .select()
          .from(tasks)
          .where(eq(tasks.id, res.taskId))

        if (originalTask) {
          const doneColli = originalTask.colliCount - remainingColli
          const doneExpected = calcExpectedMinutes(Math.max(1, doneColli))

          // Update original task to reflect actual completed colli
          await txDb
            .update(tasks)
            .set({
              colliCount: Math.max(1, doneColli),
              expectedMinutes: doneExpected,
              updatedAt: now,
            })
            .where(eq(tasks.id, res.taskId))

          // Close ALL sessions on original task
          await txDb
            .update(taskSessions)
            .set({ endedAt: now, updatedAt: now })
            .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))

          // Create continuation task for remaining people
          if (otherActiveSessions.length > 0 && remainingColli > 0) {
            const [continuationTask] = await txDb
              .insert(tasks)
              .values({
                department: originalTask.department,
                colliCount: remainingColli,
                expectedMinutes: calcExpectedMinutes(remainingColli),
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

    // Auto-close any remaining active sessions for personnel not covered by resolutions
    // (safety net — resolutions should cover all conflicts when submitted correctly)
    const resolvedPersonnelIds = resolutions.map((r) => r.personnelId)
    const unresolvedIds = personnelIds.filter((id) => !resolvedPersonnelIds.includes(id))
    if (unresolvedIds.length > 0) {
      await txDb
        .update(taskSessions)
        .set({ endedAt: now, updatedAt: now })
        .where(
          and(
            inArray(taskSessions.personnelId, unresolvedIds),
            isNull(taskSessions.endedAt),
          ),
        )
    }

    // Create the new task
    const [task] = await txDb
      .insert(tasks)
      .values({ department, colliCount, expectedMinutes, notes: notes ?? null })
      .returning()

    // Create sessions for all assigned personnel
    const sessionInserts = personnelIds.map((personnelId) => ({
      taskId: task.id,
      personnelId,
      startedAt: now,
      workDate,
    }))
    const newSessions = await txDb.insert(taskSessions).values(sessionInserts).returning()

    await client.query('COMMIT')
    return Response.json({ task, sessions: newSessions }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    return Response.json({ error: 'Failed to start task' }, { status: 500 })
  } finally {
    client.release()
  }
}

import { NextRequest } from 'next/server'
import { db, withTransaction } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { startTaskSchema } from '@/lib/validations'
import { calcExpectedMinutes, todayDate } from '@/lib/business'
import { eq, desc, isNull, sql, and, gte, lte, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'
import type { ClientBase } from 'pg'
import type { NodePgClient } from 'drizzle-orm/node-postgres'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const personnelId = searchParams.get('personnelId')
    const department = searchParams.get('department')
    const activeOnly = searchParams.get('active') === 'true'
    const todayOnly = searchParams.get('today') === 'true'
    const todayDateParam = searchParams.get('todayDate')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')))

    const baseConditions: ReturnType<typeof eq>[] = []
    if (todayOnly) {
      const requestedToday =
        todayDateParam && /^\d{4}-\d{2}-\d{2}$/.test(todayDateParam)
          ? todayDateParam
          : todayDate()
      baseConditions.push(eq(taskSessions.workDate, requestedToday))
    } else {
      if (dateFrom) baseConditions.push(gte(taskSessions.workDate, dateFrom))
      if (dateTo) baseConditions.push(lte(taskSessions.workDate, dateTo))
    }
    if (personnelId) baseConditions.push(eq(taskSessions.personnelId, personnelId))
    if (department) baseConditions.push(eq(tasks.department, department))
    if (activeOnly) baseConditions.push(isNull(taskSessions.endedAt))

    const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined

    const sessionSelect = {
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
    }

    if (todayOnly) {
      const rows = await db
        .select(sessionSelect)
        .from(taskSessions)
        .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
        .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
        .where(whereClause)
        .orderBy(desc(taskSessions.startedAt))

      return Response.json({ sessions: rows, total: rows.length, page: 1, pageSize: rows.length })
    }

    // Paginate by distinct task
    const taskIdRows = await db
      .select({ taskId: taskSessions.taskId, latestStart: sql<string>`MAX(${taskSessions.startedAt})` })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)
      .groupBy(taskSessions.taskId)
      .orderBy(sql`MAX(${taskSessions.startedAt}) DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    const [{ total }] = await db
      .select({ total: sql<number>`COUNT(DISTINCT ${taskSessions.taskId})` })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)

    const pagedTaskIds = taskIdRows.map((r) => r.taskId)

    if (pagedTaskIds.length === 0) {
      return Response.json({ sessions: [], total: Number(total), page, pageSize })
    }

    const rows = await db
      .select(sessionSelect)
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
      .where(inArray(taskSessions.taskId, pagedTaskIds))
      .orderBy(desc(taskSessions.startedAt))

    return Response.json({ sessions: rows, total: Number(total), page, pageSize })
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
    const workDate = parsed.data.workDate ?? todayDate()

    const result = await withTransaction(async (client: ClientBase) => {
      const txDb = drizzle(client as unknown as NodePgClient, { schema })

      for (const res of resolutions) {
        if (res.isDone) {
          await txDb
            .update(taskSessions)
            .set({ endedAt: now, updatedAt: now })
            .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))
        } else {
          const remainingColli = res.remainingColli ?? 0
          const selectedPersonnelSet = new Set(personnelIds)

          const activeSessions = await txDb
            .select({ personnelId: taskSessions.personnelId })
            .from(taskSessions)
            .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))

          const otherActiveSessions = activeSessions.filter(
            (s) => !selectedPersonnelSet.has(s.personnelId),
          )
          const activePersonnelCount = Math.max(1, activeSessions.length)

          const [originalTask] = await txDb
            .select()
            .from(tasks)
            .where(eq(tasks.id, res.taskId))

          if (originalTask) {
            const doneColli = Math.max(1, originalTask.colliCount - remainingColli)

            await txDb
              .update(tasks)
              .set({
                colliCount: doneColli,
                expectedMinutes: calcExpectedMinutes(doneColli, activePersonnelCount),
                updatedAt: now,
              })
              .where(eq(tasks.id, res.taskId))

            await txDb
              .update(taskSessions)
              .set({ endedAt: now, updatedAt: now })
              .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))

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

      await txDb
        .update(taskSessions)
        .set({ endedAt: now, updatedAt: now })
        .where(and(inArray(taskSessions.personnelId, personnelIds), isNull(taskSessions.endedAt)))

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

import { NextRequest } from 'next/server'
import { db, withTransaction } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { startTaskSchema } from '@/lib/validations'
import {
  calcExpectedMinutes,
  calcTaskProjectedExpectedMinutes,
  calcExpectedMinutesForSession,
  calcActualMinutesNet,
  roundToOne,
  todayDate,
} from '@/lib/business'
import { eq, desc, isNull, isNotNull, sql, and, gte, lte, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'
import type { ClientBase } from 'pg'
import type { NodePgClient } from 'drizzle-orm/node-postgres'
import { refreshAnalyticsForCompletedSessions } from '@/lib/analytics-refresh'

type SessionRow = {
  sessionId: string
  taskId: string
  department: string
  discountContainer: boolean
  colliCount: number
  expectedMinutes: number
  taskNotes: string | null
  personnelId: string
  personnelName: string
  startedAt: Date
  endedAt: Date | null
  isPaused: boolean
  pausedSince: Date | null
  totalPausedMinutes: number
  workDate: string
}

type EndedAnalyticsSession = {
  personnelId: string
  workDate: string
  department: string
}

function withProjectedMetrics(rows: SessionRow[]) {
  const taskSummaries = new Map<string, { projectedExpectedMinutes: number; taskStartedAtMs: number }>()

  const byTask = new Map<string, SessionRow[]>()
  for (const row of rows) {
    if (!byTask.has(row.taskId)) byTask.set(row.taskId, [])
    byTask.get(row.taskId)!.push(row)
  }

  for (const [taskId, taskRows] of byTask.entries()) {
    const summary = calcTaskProjectedExpectedMinutes(
      taskRows[0]!.colliCount,
      taskRows.map((r) => r.startedAt),
      taskRows[0]!.discountContainer,
    )
    if (summary) taskSummaries.set(taskId, summary)
  }

  return rows.map((row) => {
    const summary = taskSummaries.get(row.taskId)
    const projectedExpected = summary?.projectedExpectedMinutes ?? row.expectedMinutes
    const expectedSessionMinutes = calcExpectedMinutesForSession(
      projectedExpected,
      summary?.taskStartedAtMs ?? row.startedAt,
      row.startedAt,
    )
    const actualMinutes = calcActualMinutesNet(
      row.startedAt,
      row.endedAt,
      Number(row.totalPausedMinutes ?? 0),
    )
    const performanceDiff = actualMinutes !== null
      ? roundToOne(actualMinutes - expectedSessionMinutes)
      : null

    return {
      ...row,
      expectedSessionMinutes,
      actualMinutes,
      performanceDiff,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const personnelId = searchParams.get('personnelId')
    const department = searchParams.get('department')
    const activeOnly = searchParams.get('active') === 'true'
    const completedOnly = searchParams.get('completed') === 'true'
    const todayOnly = searchParams.get('today') === 'true'
    const todayDateParam = searchParams.get('todayDate')
    const paginate = searchParams.get('paginate') !== 'false'
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
    if (completedOnly) baseConditions.push(isNotNull(taskSessions.endedAt))

    const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined

    const sessionSelect = {
      sessionId: taskSessions.id,
      taskId: tasks.id,
      department: tasks.department,
      discountContainer: tasks.discountContainer,
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
    }

    if (todayOnly) {
      const [countRow] = await db
        .select({
          total: sql<number>`COUNT(DISTINCT ${taskSessions.taskId})`,
          totalActive: sql<number>`COUNT(DISTINCT CASE WHEN ${taskSessions.endedAt} IS NULL THEN ${taskSessions.taskId} END)`,
          totalPersonnel: sql<number>`COUNT(DISTINCT ${taskSessions.personnelId})`,
        })
        .from(taskSessions)
        .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
        .where(whereClause)

      const total = Number(countRow?.total ?? 0)
      const totalActive = Number(countRow?.totalActive ?? 0)
      const totalPersonnel = Number(countRow?.totalPersonnel ?? 0)

      const taskIdRows = await db
        .select({ taskId: taskSessions.taskId })
        .from(taskSessions)
        .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
        .where(whereClause)
        .groupBy(taskSessions.taskId)
        .orderBy(
          sql`(COUNT(CASE WHEN ${taskSessions.endedAt} IS NULL THEN 1 END) > 0) DESC`,
          sql`MAX(${taskSessions.startedAt}) DESC`,
        )
        .limit(paginate ? pageSize : total)
        .offset(paginate ? (page - 1) * pageSize : 0)

      const pagedTaskIds = taskIdRows.map((r) => r.taskId)
      if (pagedTaskIds.length === 0) {
        return Response.json({ sessions: [], total, totalActive, totalPersonnel, page, pageSize })
      }

      const rows = await db
        .select(sessionSelect)
        .from(taskSessions)
        .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
        .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
        .where(inArray(taskSessions.taskId, pagedTaskIds))
        .orderBy(desc(taskSessions.startedAt))

      const sessions = withProjectedMetrics(rows as SessionRow[])
      return Response.json({ sessions, total, totalActive, totalPersonnel, page, pageSize })
    }

    // Paginate by distinct task
    const taskIdsQuery = db
      .select({ taskId: taskSessions.taskId, latestStart: sql<string>`MAX(${taskSessions.startedAt})` })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)
      .groupBy(taskSessions.taskId)
      .orderBy(sql`MAX(${taskSessions.startedAt}) DESC`)

    const taskIdRows = paginate
      ? await taskIdsQuery.limit(pageSize).offset((page - 1) * pageSize)
      : await taskIdsQuery

    const [countRow] = await db
      .select({
        total: sql<number>`COUNT(DISTINCT ${taskSessions.taskId})`,
        totalActive: sql<number>`COUNT(DISTINCT CASE WHEN ${taskSessions.endedAt} IS NULL THEN ${taskSessions.taskId} END)`,
        totalPersonnel: sql<number>`COUNT(DISTINCT ${taskSessions.personnelId})`,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)

    const total = Number(countRow?.total ?? 0)
    const totalActive = Number(countRow?.totalActive ?? 0)
    const totalPersonnel = Number(countRow?.totalPersonnel ?? 0)

    const pagedTaskIds = taskIdRows.map((r) => r.taskId)

    if (pagedTaskIds.length === 0) {
      return Response.json({ sessions: [], total, totalActive, totalPersonnel, page, pageSize })
    }

    const rows = await db
      .select(sessionSelect)
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
      .where(inArray(taskSessions.taskId, pagedTaskIds))
      .orderBy(desc(taskSessions.startedAt))

    const sessions = withProjectedMetrics(rows as SessionRow[])
    return Response.json({ sessions, total, totalActive, totalPersonnel, page, pageSize })
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

    const { personnelIds, department, discountContainer, colliCount, notes, resolutions } = parsed.data
    const expectedMinutes = calcExpectedMinutes(colliCount, personnelIds.length, discountContainer)
    const now = new Date()
    const workDate = parsed.data.workDate ?? todayDate()

    const result = await withTransaction(async (client: ClientBase) => {
      const txDb = drizzle(client as unknown as NodePgClient, { schema })
      const endedSessions: EndedAnalyticsSession[] = []

      for (const res of resolutions) {
        if (res.isDone) {
          const conflictSessions = await txDb
            .select({
              personnelId: taskSessions.personnelId,
              workDate: taskSessions.workDate,
              department: tasks.department,
            })
            .from(taskSessions)
            .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
            .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))

          await txDb
            .update(taskSessions)
            .set({ endedAt: now, updatedAt: now })
            .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))

          for (const session of conflictSessions) {
            endedSessions.push({
              personnelId: session.personnelId,
              workDate: String(session.workDate).slice(0, 10),
              department: session.department,
            })
          }
        } else {
          const remainingColli = res.remainingColli ?? 0
          const selectedPersonnelSet = new Set(personnelIds)

          const activeSessions = await txDb
            .select({
              personnelId: taskSessions.personnelId,
              workDate: taskSessions.workDate,
            })
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
                expectedMinutes: calcExpectedMinutes(
                  doneColli,
                  activePersonnelCount,
                  originalTask.discountContainer,
                ),
                updatedAt: now,
              })
              .where(eq(tasks.id, res.taskId))

            await txDb
              .update(taskSessions)
              .set({ endedAt: now, updatedAt: now })
              .where(and(eq(taskSessions.taskId, res.taskId), isNull(taskSessions.endedAt)))

            for (const session of activeSessions) {
              endedSessions.push({
                personnelId: session.personnelId,
                workDate: String(session.workDate).slice(0, 10),
                department: originalTask.department,
              })
            }

            if (otherActiveSessions.length > 0 && remainingColli > 0) {
              const [continuationTask] = await txDb
                .insert(tasks)
                .values({
                  department: originalTask.department,
                  discountContainer: originalTask.discountContainer,
                  colliCount: remainingColli,
                  expectedMinutes: calcExpectedMinutes(
                    remainingColli,
                    otherActiveSessions.length,
                    originalTask.discountContainer,
                  ),
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

      const priorActiveSessions = await txDb
        .select({
          personnelId: taskSessions.personnelId,
          workDate: taskSessions.workDate,
          department: tasks.department,
        })
        .from(taskSessions)
        .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
        .where(and(inArray(taskSessions.personnelId, personnelIds), isNull(taskSessions.endedAt)))

      await txDb
        .update(taskSessions)
        .set({ endedAt: now, updatedAt: now })
        .where(and(inArray(taskSessions.personnelId, personnelIds), isNull(taskSessions.endedAt)))

      for (const session of priorActiveSessions) {
        endedSessions.push({
          personnelId: session.personnelId,
          workDate: String(session.workDate).slice(0, 10),
          department: session.department,
        })
      }

      const [task] = await txDb
        .insert(tasks)
        .values({
          department,
          discountContainer,
          colliCount,
          expectedMinutes,
          notes: notes ?? null,
        })
        .returning()

      const newSessions = await txDb
        .insert(taskSessions)
        .values(personnelIds.map((personnelId) => ({ taskId: task.id, personnelId, startedAt: now, workDate })))
        .returning()

      return { task, sessions: newSessions, endedSessions }
    })

    void refreshAnalyticsForCompletedSessions(result.endedSessions).catch(console.error)

    return Response.json({ task: result.task, sessions: result.sessions }, { status: 201 })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Failed to start task' }, { status: 500 })
  }
}

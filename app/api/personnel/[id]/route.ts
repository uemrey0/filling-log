import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnel, taskSessions, tasks } from '@/lib/db/schema'
import { personnelSchema } from '@/lib/validations'
import {
  calcTaskProjectedExpectedMinutes,
  calcExpectedMinutesForSession,
  calcActualMinutesNet,
  roundToOne,
} from '@/lib/business'
import { eq, desc, and, gte, lte, isNotNull, count, inArray } from 'drizzle-orm'

const STATS_BATCH_SIZE = 500
const STATS_MAX_ROWS = 10000

function buildSessionSelect() {
  return {
    id: taskSessions.id,
    startedAt: taskSessions.startedAt,
    endedAt: taskSessions.endedAt,
    totalPausedMinutes: taskSessions.totalPausedMinutes,
    workDate: taskSessions.workDate,
    taskId: taskSessions.taskId,
    department: tasks.department,
    discountContainer: tasks.discountContainer,
    colliCount: tasks.colliCount,
    expectedMinutes: tasks.expectedMinutes,
  }
}

type SessionRow = {
  id: string
  startedAt: Date
  endedAt: Date | null
  totalPausedMinutes: number
  workDate: string
  taskId: string
  department: string
  discountContainer: boolean
  colliCount: number
  expectedMinutes: number
}

type TaskTimingRow = {
  taskId: string
  colliCount: number
  discountContainer: boolean
  startedAt: Date
}

type TaskTimingSummary = {
  projectedExpectedMinutes: number
  taskStartedAtMs: number
}

function buildTaskTimingMap(rows: TaskTimingRow[]): Map<string, TaskTimingSummary> {
  const byTask = new Map<string, TaskTimingRow[]>()
  for (const row of rows) {
    if (!byTask.has(row.taskId)) byTask.set(row.taskId, [])
    byTask.get(row.taskId)!.push(row)
  }

  const summaries = new Map<string, TaskTimingSummary>()
  for (const [taskId, taskRows] of byTask.entries()) {
    const summary = calcTaskProjectedExpectedMinutes(
      taskRows[0]!.colliCount,
      taskRows.map((r) => r.startedAt),
      taskRows[0]!.discountContainer,
    )
    if (summary) summaries.set(taskId, summary)
  }

  return summaries
}

async function loadTaskTimingMap(taskIds: string[]): Promise<Map<string, TaskTimingSummary>> {
  if (taskIds.length === 0) return new Map()

  const timingRows = await db
    .select({
      taskId: taskSessions.taskId,
      colliCount: tasks.colliCount,
      discountContainer: tasks.discountContainer,
      startedAt: taskSessions.startedAt,
    })
    .from(taskSessions)
    .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
    .where(inArray(taskSessions.taskId, taskIds))

  return buildTaskTimingMap(timingRows)
}

function enrichSessionsWithProjectedMetrics(
  sessions: SessionRow[],
  timingMap: Map<string, TaskTimingSummary>,
) {
  return sessions.map((session) => {
    const summary = timingMap.get(session.taskId)
    const expectedSessionMinutes = calcExpectedMinutesForSession(
      summary?.projectedExpectedMinutes ?? session.expectedMinutes,
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
}

async function getStats(personnelId: string, dateFrom?: string | null, dateTo?: string | null) {
  const conditions = [eq(taskSessions.personnelId, personnelId), isNotNull(taskSessions.endedAt)]
  if (dateFrom) conditions.push(gte(taskSessions.workDate, dateFrom))
  if (dateTo) conditions.push(lte(taskSessions.workDate, dateTo))

  const [{ totalEndedSessions }] = await db
    .select({ totalEndedSessions: count(taskSessions.id) })
    .from(taskSessions)
    .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
    .where(and(...conditions))

  const totalEnded = Number(totalEndedSessions)
  if (totalEnded === 0) {
    return { totalSessions: 0, avgDiff: null, avgActualPerColli: null }
  }

  const processLimit = Math.min(totalEnded, STATS_MAX_ROWS)
  const timingMapCache = new Map<string, TaskTimingSummary>()

  let diffTotal = 0
  let diffCount = 0
  let actualPerColliTotal = 0
  let actualPerColliCount = 0

  for (let offset = 0; offset < processLimit; offset += STATS_BATCH_SIZE) {
    const batchRows = await db
      .select({
        taskId: taskSessions.taskId,
        startedAt: taskSessions.startedAt,
        endedAt: taskSessions.endedAt,
        totalPausedMinutes: taskSessions.totalPausedMinutes,
        colliCount: tasks.colliCount,
        discountContainer: tasks.discountContainer,
        expectedMinutes: tasks.expectedMinutes,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(and(...conditions))
      .orderBy(desc(taskSessions.startedAt))
      .limit(Math.min(STATS_BATCH_SIZE, processLimit - offset))
      .offset(offset)

    if (batchRows.length === 0) break

    const missingTaskIds = Array.from(
      new Set(
        batchRows
          .map((row) => row.taskId)
          .filter((taskId) => !timingMapCache.has(taskId)),
      ),
    )
    if (missingTaskIds.length > 0) {
      const loadedMap = await loadTaskTimingMap(missingTaskIds)
      for (const [taskId, summary] of loadedMap.entries()) {
        timingMapCache.set(taskId, summary)
      }
    }

    for (const row of batchRows) {
      const summary = timingMapCache.get(row.taskId)
      const expectedSessionMinutes = calcExpectedMinutesForSession(
        summary?.projectedExpectedMinutes ?? row.expectedMinutes,
        summary?.taskStartedAtMs ?? row.startedAt,
        row.startedAt,
      )
      const actualMinutes = calcActualMinutesNet(
        row.startedAt,
        row.endedAt,
        Number(row.totalPausedMinutes ?? 0),
      )
      if (actualMinutes === null) continue

      const diff = roundToOne(actualMinutes - expectedSessionMinutes)
      diffTotal += diff
      diffCount++

      if (row.colliCount > 0) {
        actualPerColliTotal += actualMinutes / row.colliCount
        actualPerColliCount++
      }
    }
  }

  return {
    totalSessions: totalEnded,
    avgDiff: diffCount > 0 ? roundToOne(diffTotal / diffCount) : null,
    avgActualPerColli: actualPerColliCount > 0
      ? Math.round((actualPerColliTotal / actualPerColliCount) * 100) / 100
      : null,
    ...(totalEnded > STATS_MAX_ROWS ? { limited: true, sampledSessions: processLimit } : {}),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const [person] = await db.select().from(personnel).where(eq(personnel.id, id))
    if (!person) return Response.json({ error: 'Not found' }, { status: 404 })

    const sessionConditions = [eq(taskSessions.personnelId, id)]
    if (dateFrom) sessionConditions.push(gte(taskSessions.workDate, dateFrom))
    if (dateTo) sessionConditions.push(lte(taskSessions.workDate, dateTo))

    const [{ total }] = await db
      .select({ total: count(taskSessions.id) })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(and(...sessionConditions))

    const rawSessions = await db
      .select(buildSessionSelect())
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(and(...sessionConditions))
      .orderBy(desc(taskSessions.startedAt))
      .limit(limit)
      .offset((page - 1) * limit)

    const taskIds = Array.from(new Set(rawSessions.map((session) => session.taskId)))
    const timingMap = await loadTaskTimingMap(taskIds)
    const sessions = enrichSessionsWithProjectedMetrics(rawSessions as SessionRow[], timingMap)

    const stats = await getStats(id, dateFrom, dateTo)

    // Compute previous period comparison when date range is provided
    let prevStats = null
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom)
      const to = new Date(dateTo)
      const periodMs = to.getTime() - from.getTime()
      const prevTo = new Date(from.getTime() - 86400000) // day before dateFrom
      const prevFrom = new Date(prevTo.getTime() - periodMs)
      prevStats = await getStats(
        id,
        prevFrom.toISOString().slice(0, 10),
        prevTo.toISOString().slice(0, 10),
      )
    }

    return Response.json({
      ...person,
      sessions,
      total: Number(total),
      page,
      limit,
      stats,
      prevStats,
    })
  } catch (err) {
    console.error('[GET /api/personnel/[id]]', err)
    return Response.json({ error: 'Failed to fetch personnel' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = personnelSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const [updated] = await db
      .update(personnel)
      .set({
        fullName: parsed.data.fullName,
        isActive: parsed.data.isActive ?? true,
        notes: parsed.data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(personnel.id, id))
      .returning()

    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Failed to update personnel' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const [updated] = await db
      .update(personnel)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(personnel.id, id))
      .returning()

    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Failed to deactivate personnel' }, { status: 500 })
  }
}

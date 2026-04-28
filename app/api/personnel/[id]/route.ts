import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  personnel,
  taskSessions,
  tasks,
  personnelDailyStats,
  personnelDepartmentDailyStats,
} from '@/lib/db/schema'
import { personnelSchema } from '@/lib/validations'
import {
  calcTaskProjectedExpectedMinutes,
  calcExpectedMinutesForSession,
  calcActualMinutesNet,
  roundToOne,
} from '@/lib/business'
import { eq, desc, and, gte, lte, count, inArray, sum } from 'drizzle-orm'

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
  const conditions = [eq(personnelDailyStats.personnelId, personnelId)]
  if (dateFrom) conditions.push(gte(personnelDailyStats.workDate, dateFrom))
  if (dateTo) conditions.push(lte(personnelDailyStats.workDate, dateTo))

  const [row] = await db
    .select({
      sessionCount: sum(personnelDailyStats.sessionCount),
      diffSum: sum(personnelDailyStats.diffMinutesSum),
      perColliSum: sum(personnelDailyStats.actualPerColliSum),
      perColliCount: sum(personnelDailyStats.actualPerColliCount),
    })
    .from(personnelDailyStats)
    .where(and(...conditions))

  const totalSessions = Number(row?.sessionCount ?? 0)
  if (totalSessions === 0) return { totalSessions: 0, avgDiff: null, avgActualPerColli: null }

  const perColliCount = Number(row?.perColliCount ?? 0)
  return {
    totalSessions,
    avgDiff: roundToOne(Number(row?.diffSum ?? 0) / totalSessions),
    avgActualPerColli: perColliCount > 0
      ? Math.round((Number(row?.perColliSum ?? 0) / perColliCount) * 100) / 100
      : null,
  }
}

async function getDepartmentStats(personnelId: string, dateFrom?: string | null, dateTo?: string | null) {
  const conditions = [eq(personnelDepartmentDailyStats.personnelId, personnelId)]
  if (dateFrom) conditions.push(gte(personnelDepartmentDailyStats.workDate, dateFrom))
  if (dateTo) conditions.push(lte(personnelDepartmentDailyStats.workDate, dateTo))

  const rows = await db
    .select({
      department: personnelDepartmentDailyStats.department,
      sessionCount: sum(personnelDepartmentDailyStats.sessionCount),
      diffSum: sum(personnelDepartmentDailyStats.diffMinutesSum),
    })
    .from(personnelDepartmentDailyStats)
    .where(and(...conditions))
    .groupBy(personnelDepartmentDailyStats.department)

  return rows
    .map((row) => {
      const sessionCount = Number(row.sessionCount ?? 0)
      return {
        department: row.department,
        sessionCount,
        avgDiff: sessionCount > 0 ? roundToOne(Number(row.diffSum ?? 0) / sessionCount) : null,
      }
    })
    .sort((a, b) => b.sessionCount - a.sessionCount)
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
    const departmentStats = await getDepartmentStats(id, dateFrom, dateTo)

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
      departmentStats,
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

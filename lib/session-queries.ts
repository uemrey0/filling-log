import { and, count, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import {
  calcActualMinutesNet,
  calcExpectedMinutesForSession,
  calcTaskProjectedExpectedMinutes,
  roundToOne,
} from '@/lib/business'

type DateRangeFilters = {
  dateFrom?: string | null
  dateTo?: string | null
}

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
      taskRows.map((row) => row.startedAt),
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

export async function getPersonnelSessions(
  personnelId: string,
  {
    dateFrom,
    dateTo,
    page,
    limit,
  }: DateRangeFilters & { page: number; limit: number },
) {
  const conditions = [eq(taskSessions.personnelId, personnelId)]
  if (dateFrom) conditions.push(gte(taskSessions.workDate, dateFrom))
  if (dateTo) conditions.push(lte(taskSessions.workDate, dateTo))

  const [{ total }] = await db
    .select({ total: count(taskSessions.id) })
    .from(taskSessions)
    .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
    .where(and(...conditions))

  const rawSessions = await db
    .select(buildSessionSelect())
    .from(taskSessions)
    .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(desc(taskSessions.startedAt))
    .limit(limit)
    .offset((page - 1) * limit)

  const taskIds = Array.from(new Set(rawSessions.map((session) => session.taskId)))
  const timingMap = await loadTaskTimingMap(taskIds)

  return {
    sessions: enrichSessionsWithProjectedMetrics(rawSessions as SessionRow[], timingMap),
    total: Number(total),
    page,
    limit,
  }
}

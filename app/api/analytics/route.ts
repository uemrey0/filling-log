import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import {
  calcTaskProjectedExpectedMinutes,
  calcExpectedMinutesForSession,
  calcActualMinutesNet,
  roundToOne,
} from '@/lib/business'
import { eq, and, gte, lte, isNotNull, count, desc, inArray } from 'drizzle-orm'

const ANALYTICS_BATCH_SIZE = 1000
const ANALYTICS_MAX_ROWS = 50000

type AnalyticsSessionRow = {
  taskId: string
  personnelId: string
  personnelName: string
  department: string
  discountContainer: boolean
  workDate: string
  colliCount: number
  expectedMinutes: number
  startedAt: Date
  endedAt: Date | null
  totalPausedMinutes: number
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

function averageRounded(sum: number, countValue: number): number | null {
  if (countValue === 0) return null
  return roundToOne(sum / countValue)
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

async function loadTaskTimingSummaries(
  taskIds: string[],
  cache: Map<string, TaskTimingSummary>,
): Promise<void> {
  const missingTaskIds = taskIds.filter((taskId) => !cache.has(taskId))
  if (missingTaskIds.length === 0) return

  const timingRows = await db
    .select({
      taskId: taskSessions.taskId,
      colliCount: tasks.colliCount,
      discountContainer: tasks.discountContainer,
      startedAt: taskSessions.startedAt,
    })
    .from(taskSessions)
    .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
    .where(inArray(taskSessions.taskId, missingTaskIds)) as TaskTimingRow[]

  const summaryMap = buildTaskTimingMap(timingRows)
  for (const taskId of missingTaskIds) {
    const summary = summaryMap.get(taskId)
    if (summary) cache.set(taskId, summary)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const personnelId = searchParams.get('personnelId')
    const department = searchParams.get('department')

    const conditions = [isNotNull(taskSessions.endedAt)]
    if (dateFrom) conditions.push(gte(taskSessions.workDate, dateFrom))
    if (dateTo) conditions.push(lte(taskSessions.workDate, dateTo))
    if (personnelId) conditions.push(eq(taskSessions.personnelId, personnelId))
    if (department) conditions.push(eq(tasks.department, department))

    const whereClause = and(...conditions)

    const [{ totalSessions }] = await db
      .select({ totalSessions: count(taskSessions.id) })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)

    const totalSessionsNumber = Number(totalSessions)
    if (totalSessionsNumber > ANALYTICS_MAX_ROWS) {
      return Response.json(
        {
          error: `Analytics range too wide (${totalSessionsNumber} sessions). Narrow the date range.`,
          code: 'ANALYTICS_RANGE_TOO_WIDE',
          maxSessions: ANALYTICS_MAX_ROWS,
        },
        { status: 400 },
      )
    }

    if (totalSessionsNumber === 0) {
      return Response.json({
        overview: {
          totalSessions: 0,
          avgExpectedMinutes: null,
          avgActualMinutes: null,
          avgDiffMinutes: null,
        },
        byPersonnel: [],
        byDepartment: [],
        daily: [],
      })
    }

    const taskTimingCache = new Map<string, TaskTimingSummary>()
    let processedCount = 0
    let expectedSum = 0
    let actualSum = 0
    let diffSum = 0

    const byPersonnelMap = new Map<string, {
      personnelId: string
      personnelName: string
      sessionCount: number
      expectedSum: number
      actualSum: number
      diffSum: number
      actualPerColliSum: number
      actualPerColliCount: number
    }>()
    const byDepartmentMap = new Map<string, {
      department: string
      sessionCount: number
      expectedSum: number
      actualSum: number
      diffSum: number
    }>()
    const dailyMap = new Map<string, { sessionCount: number; diffSum: number }>()

    for (let offset = 0; offset < totalSessionsNumber; offset += ANALYTICS_BATCH_SIZE) {
      const chunk = await db
        .select({
          taskId: taskSessions.taskId,
          personnelId: taskSessions.personnelId,
          personnelName: personnel.fullName,
          department: tasks.department,
          discountContainer: tasks.discountContainer,
          workDate: taskSessions.workDate,
          colliCount: tasks.colliCount,
          expectedMinutes: tasks.expectedMinutes,
          startedAt: taskSessions.startedAt,
          endedAt: taskSessions.endedAt,
          totalPausedMinutes: taskSessions.totalPausedMinutes,
        })
        .from(taskSessions)
        .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
        .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
        .where(whereClause)
        .orderBy(desc(taskSessions.startedAt))
        .limit(ANALYTICS_BATCH_SIZE)
        .offset(offset) as AnalyticsSessionRow[]

      if (chunk.length === 0) break

      const taskIds = Array.from(new Set(chunk.map((row) => row.taskId)))
      await loadTaskTimingSummaries(taskIds, taskTimingCache)

      for (const row of chunk) {
        const summary = taskTimingCache.get(row.taskId)
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

        const diffMinutes = roundToOne(actualMinutes - expectedSessionMinutes)
        processedCount++
        expectedSum += expectedSessionMinutes
        actualSum += actualMinutes
        diffSum += diffMinutes

        if (!byPersonnelMap.has(row.personnelId)) {
          byPersonnelMap.set(row.personnelId, {
            personnelId: row.personnelId,
            personnelName: row.personnelName,
            sessionCount: 0,
            expectedSum: 0,
            actualSum: 0,
            diffSum: 0,
            actualPerColliSum: 0,
            actualPerColliCount: 0,
          })
        }
        const personnelEntry = byPersonnelMap.get(row.personnelId)!
        personnelEntry.sessionCount++
        personnelEntry.expectedSum += expectedSessionMinutes
        personnelEntry.actualSum += actualMinutes
        personnelEntry.diffSum += diffMinutes
        if (row.colliCount > 0) {
          personnelEntry.actualPerColliSum += actualMinutes / row.colliCount
          personnelEntry.actualPerColliCount++
        }

        if (!byDepartmentMap.has(row.department)) {
          byDepartmentMap.set(row.department, {
            department: row.department,
            sessionCount: 0,
            expectedSum: 0,
            actualSum: 0,
            diffSum: 0,
          })
        }
        const departmentEntry = byDepartmentMap.get(row.department)!
        departmentEntry.sessionCount++
        departmentEntry.expectedSum += expectedSessionMinutes
        departmentEntry.actualSum += actualMinutes
        departmentEntry.diffSum += diffMinutes

        if (!dailyMap.has(row.workDate)) {
          dailyMap.set(row.workDate, { sessionCount: 0, diffSum: 0 })
        }
        const dailyEntry = dailyMap.get(row.workDate)!
        dailyEntry.sessionCount++
        dailyEntry.diffSum += diffMinutes
      }
    }

    const overview = {
      totalSessions: processedCount,
      avgExpectedMinutes: averageRounded(expectedSum, processedCount),
      avgActualMinutes: averageRounded(actualSum, processedCount),
      avgDiffMinutes: averageRounded(diffSum, processedCount),
    }

    const byPersonnel = Array.from(byPersonnelMap.values())
      .map((entry) => ({
        personnelId: entry.personnelId,
        personnelName: entry.personnelName,
        sessionCount: entry.sessionCount,
        avgExpected: averageRounded(entry.expectedSum, entry.sessionCount),
        avgActual: averageRounded(entry.actualSum, entry.sessionCount),
        avgDiff: averageRounded(entry.diffSum, entry.sessionCount),
        avgActualPerColli: entry.actualPerColliCount > 0
          ? Math.round((entry.actualPerColliSum / entry.actualPerColliCount) * 100) / 100
          : null,
      }))
      .sort((a, b) => (a.avgActualPerColli ?? Infinity) - (b.avgActualPerColli ?? Infinity))

    const byDepartment = Array.from(byDepartmentMap.values())
      .map((entry) => ({
        department: entry.department,
        sessionCount: entry.sessionCount,
        avgExpected: averageRounded(entry.expectedSum, entry.sessionCount),
        avgActual: averageRounded(entry.actualSum, entry.sessionCount),
        avgDiff: averageRounded(entry.diffSum, entry.sessionCount),
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)

    const daily = Array.from(dailyMap.entries())
      .map(([date, entry]) => ({
        date,
        sessionCount: entry.sessionCount,
        avgDiff: averageRounded(entry.diffSum, entry.sessionCount),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)

    return Response.json({ overview, byPersonnel, byDepartment, daily })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

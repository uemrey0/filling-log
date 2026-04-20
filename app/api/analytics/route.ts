import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import {
  calcTaskProjectedExpectedMinutes,
  calcExpectedMinutesForSession,
  calcActualMinutesNet,
  roundToOne,
} from '@/lib/business'
import { eq, and, gte, lte, isNotNull, inArray } from 'drizzle-orm'

type AnalyticsSessionRow = {
  taskId: string
  personnelId: string
  personnelName: string
  department: string
  workDate: string
  colliCount: number
  expectedMinutes: number
  startedAt: Date
  endedAt: Date
  totalPausedMinutes: number
}

type TaskTimingRow = {
  taskId: string
  colliCount: number
  startedAt: Date
}

type TaskTimingSummary = {
  projectedExpectedMinutes: number
  taskStartedAtMs: number
}

function averageRounded(values: number[]): number | null {
  if (values.length === 0) return null
  return roundToOne(values.reduce((sum, value) => sum + value, 0) / values.length)
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
    )
    if (summary) summaries.set(taskId, summary)
  }
  return summaries
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

    const filteredRows = await db
      .select({
        taskId: taskSessions.taskId,
        personnelId: taskSessions.personnelId,
        personnelName: personnel.fullName,
        department: tasks.department,
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
      .where(whereClause) as AnalyticsSessionRow[]

    if (filteredRows.length === 0) {
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

    const taskIds = Array.from(new Set(filteredRows.map((row) => row.taskId)))
    const timingRows = await db
      .select({
        taskId: taskSessions.taskId,
        colliCount: tasks.colliCount,
        startedAt: taskSessions.startedAt,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(inArray(taskSessions.taskId, taskIds)) as TaskTimingRow[]

    const timingMap = buildTaskTimingMap(timingRows)

    const sessions = filteredRows
      .map((row) => {
        const summary = timingMap.get(row.taskId)
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
        if (actualMinutes === null) return null

        return {
          ...row,
          expectedSessionMinutes,
          actualMinutes,
          diffMinutes: roundToOne(actualMinutes - expectedSessionMinutes),
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    const overview = {
      totalSessions: sessions.length,
      avgExpectedMinutes: averageRounded(sessions.map((row) => row.expectedSessionMinutes)),
      avgActualMinutes: averageRounded(sessions.map((row) => row.actualMinutes)),
      avgDiffMinutes: averageRounded(sessions.map((row) => row.diffMinutes)),
    }

    const byPersonnelMap = new Map<string, {
      personnelId: string
      personnelName: string
      sessionCount: number
      expectedValues: number[]
      actualValues: number[]
      diffValues: number[]
    }>()
    for (const row of sessions) {
      const key = row.personnelId
      if (!byPersonnelMap.has(key)) {
        byPersonnelMap.set(key, {
          personnelId: row.personnelId,
          personnelName: row.personnelName,
          sessionCount: 0,
          expectedValues: [],
          actualValues: [],
          diffValues: [],
        })
      }
      const entry = byPersonnelMap.get(key)!
      entry.sessionCount++
      entry.expectedValues.push(row.expectedSessionMinutes)
      entry.actualValues.push(row.actualMinutes)
      entry.diffValues.push(row.diffMinutes)
    }
    const byPersonnel = Array.from(byPersonnelMap.values())
      .map((entry) => ({
        personnelId: entry.personnelId,
        personnelName: entry.personnelName,
        sessionCount: entry.sessionCount,
        avgExpected: averageRounded(entry.expectedValues),
        avgActual: averageRounded(entry.actualValues),
        avgDiff: averageRounded(entry.diffValues),
      }))
      .sort((a, b) => (a.avgDiff ?? 0) - (b.avgDiff ?? 0))

    const byDepartmentMap = new Map<string, {
      department: string
      sessionCount: number
      expectedValues: number[]
      actualValues: number[]
      diffValues: number[]
    }>()
    for (const row of sessions) {
      const key = row.department
      if (!byDepartmentMap.has(key)) {
        byDepartmentMap.set(key, {
          department: row.department,
          sessionCount: 0,
          expectedValues: [],
          actualValues: [],
          diffValues: [],
        })
      }
      const entry = byDepartmentMap.get(key)!
      entry.sessionCount++
      entry.expectedValues.push(row.expectedSessionMinutes)
      entry.actualValues.push(row.actualMinutes)
      entry.diffValues.push(row.diffMinutes)
    }
    const byDepartment = Array.from(byDepartmentMap.values())
      .map((entry) => ({
        department: entry.department,
        sessionCount: entry.sessionCount,
        avgExpected: averageRounded(entry.expectedValues),
        avgActual: averageRounded(entry.actualValues),
        avgDiff: averageRounded(entry.diffValues),
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)

    const dailyMap = new Map<string, { sessionCount: number; diffValues: number[] }>()
    for (const row of sessions) {
      const key = row.workDate
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { sessionCount: 0, diffValues: [] })
      }
      const entry = dailyMap.get(key)!
      entry.sessionCount++
      entry.diffValues.push(row.diffMinutes)
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, entry]) => ({
        date,
        sessionCount: entry.sessionCount,
        avgDiff: averageRounded(entry.diffValues),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30)

    return Response.json({ overview, byPersonnel, byDepartment, daily })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

import { db } from '@/lib/db'
import { tasks, taskSessions, personnelDailyStats, departmentDailyStats } from '@/lib/db/schema'
import {
  calcTaskProjectedExpectedMinutes,
  calcExpectedMinutesForSession,
  calcActualMinutesNet,
  roundToOne,
} from '@/lib/business'
import { eq, and, isNotNull, inArray } from 'drizzle-orm'

type TimingRow = {
  taskId: string
  colliCount: number
  discountContainer: boolean
  startedAt: Date
}

function buildTimingMap(rows: TimingRow[]) {
  const byTask = new Map<string, TimingRow[]>()
  for (const row of rows) {
    if (!byTask.has(row.taskId)) byTask.set(row.taskId, [])
    byTask.get(row.taskId)!.push(row)
  }
  const map = new Map<string, { projectedExpectedMinutes: number; taskStartedAtMs: number }>()
  for (const [taskId, taskRows] of byTask.entries()) {
    const summary = calcTaskProjectedExpectedMinutes(
      taskRows[0]!.colliCount,
      taskRows.map((r) => r.startedAt),
      taskRows[0]!.discountContainer,
    )
    if (summary) map.set(taskId, summary)
  }
  return map
}

type SessionComputedStats = {
  actualMinutes: number
  expectedSessionMinutes: number
  diffMinutes: number
  colliCount: number
}

async function computeSessionStats(
  filters: Parameters<typeof and>[0][],
): Promise<SessionComputedStats[]> {
  const sessions = await db
    .select({
      taskId: taskSessions.taskId,
      startedAt: taskSessions.startedAt,
      endedAt: taskSessions.endedAt,
      totalPausedMinutes: taskSessions.totalPausedMinutes,
      colliCount: tasks.colliCount,
      expectedMinutes: tasks.expectedMinutes,
      discountContainer: tasks.discountContainer,
    })
    .from(taskSessions)
    .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
    .where(and(isNotNull(taskSessions.endedAt), ...filters))

  if (sessions.length === 0) return []

  const taskIds = Array.from(new Set(sessions.map((s) => s.taskId)))
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

  const timingMap = buildTimingMap(timingRows)
  const result: SessionComputedStats[] = []

  for (const row of sessions) {
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
    if (actualMinutes === null) continue
    result.push({
      actualMinutes,
      expectedSessionMinutes,
      diffMinutes: roundToOne(actualMinutes - expectedSessionMinutes),
      colliCount: row.colliCount,
    })
  }
  return result
}

// Refresh personnel stats for given (personnelId, workDate) pairs
export async function refreshPersonnelDailyStats(
  keys: { personnelId: string; workDate: string }[],
): Promise<void> {
  const unique = new Map<string, { personnelId: string; workDate: string }>()
  for (const k of keys) unique.set(`${k.personnelId}|${k.workDate}`, k)

  for (const { personnelId, workDate } of unique.values()) {
    const stats = await computeSessionStats([
      eq(taskSessions.personnelId, personnelId),
      eq(taskSessions.workDate, workDate),
    ])

    if (stats.length === 0) {
      await db.delete(personnelDailyStats).where(
        and(eq(personnelDailyStats.personnelId, personnelId), eq(personnelDailyStats.workDate, workDate)),
      )
      continue
    }

    let sessionCount = 0, actualMinutesSum = 0, expectedMinutesSum = 0, diffMinutesSum = 0
    let actualPerColliSum = 0, actualPerColliCount = 0

    for (const s of stats) {
      sessionCount++
      actualMinutesSum += s.actualMinutes
      expectedMinutesSum += s.expectedSessionMinutes
      diffMinutesSum += s.diffMinutes
      if (s.colliCount > 0) { actualPerColliSum += s.actualMinutes / s.colliCount; actualPerColliCount++ }
    }

    await db.insert(personnelDailyStats)
      .values({ personnelId, workDate, sessionCount, actualMinutesSum, expectedMinutesSum, diffMinutesSum, actualPerColliSum, actualPerColliCount, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [personnelDailyStats.personnelId, personnelDailyStats.workDate],
        set: { sessionCount, actualMinutesSum, expectedMinutesSum, diffMinutesSum, actualPerColliSum, actualPerColliCount, updatedAt: new Date() },
      })
  }
}

// Refresh department stats for given (workDate, department) pairs
export async function refreshDepartmentDailyStats(
  keys: { workDate: string; department: string }[],
): Promise<void> {
  const unique = new Map<string, { workDate: string; department: string }>()
  for (const k of keys) unique.set(`${k.workDate}|${k.department}`, k)

  for (const { workDate, department } of unique.values()) {
    const stats = await computeSessionStats([
      eq(taskSessions.workDate, workDate),
      eq(tasks.department, department),
    ])

    if (stats.length === 0) {
      await db.delete(departmentDailyStats).where(
        and(eq(departmentDailyStats.workDate, workDate), eq(departmentDailyStats.department, department)),
      )
      continue
    }

    let sessionCount = 0, actualMinutesSum = 0, expectedMinutesSum = 0, diffMinutesSum = 0
    for (const s of stats) {
      sessionCount++
      actualMinutesSum += s.actualMinutes
      expectedMinutesSum += s.expectedSessionMinutes
      diffMinutesSum += s.diffMinutes
    }

    await db.insert(departmentDailyStats)
      .values({ workDate, department, sessionCount, actualMinutesSum, expectedMinutesSum, diffMinutesSum, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [departmentDailyStats.workDate, departmentDailyStats.department],
        set: { sessionCount, actualMinutesSum, expectedMinutesSum, diffMinutesSum, updatedAt: new Date() },
      })
  }
}

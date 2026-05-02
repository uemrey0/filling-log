import { and, eq, gte, lte, sum } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  departmentDailyStats,
  personnel,
  personnelDailyStats,
  personnelDepartmentDailyStats,
} from '@/lib/db/schema'
import { roundToOne } from '@/lib/business'

type DateRangeFilters = {
  dateFrom?: string | null
  dateTo?: string | null
}

type AnalyticsFilters = DateRangeFilters & {
  personnelId?: string | null
  department?: string | null
}

function avg(totalSum: number, rowCount: number): number | null {
  if (rowCount === 0) return null
  return roundToOne(totalSum / rowCount)
}

function buildPersonnelStatsWhere({ dateFrom, dateTo, personnelId }: AnalyticsFilters) {
  const conditions = []
  if (dateFrom) conditions.push(gte(personnelDailyStats.workDate, dateFrom))
  if (dateTo) conditions.push(lte(personnelDailyStats.workDate, dateTo))
  if (personnelId) conditions.push(eq(personnelDailyStats.personnelId, personnelId))
  return conditions.length > 0 ? and(...conditions) : undefined
}

function buildPersonnelDepartmentStatsWhere({ dateFrom, dateTo, personnelId, department }: AnalyticsFilters) {
  const conditions = []
  if (dateFrom) conditions.push(gte(personnelDepartmentDailyStats.workDate, dateFrom))
  if (dateTo) conditions.push(lte(personnelDepartmentDailyStats.workDate, dateTo))
  if (personnelId) conditions.push(eq(personnelDepartmentDailyStats.personnelId, personnelId))
  if (department) conditions.push(eq(personnelDepartmentDailyStats.department, department))
  return conditions.length > 0 ? and(...conditions) : undefined
}

function buildDepartmentStatsWhere({ dateFrom, dateTo, department }: AnalyticsFilters) {
  const conditions = []
  if (dateFrom) conditions.push(gte(departmentDailyStats.workDate, dateFrom))
  if (dateTo) conditions.push(lte(departmentDailyStats.workDate, dateTo))
  if (department) conditions.push(eq(departmentDailyStats.department, department))
  return conditions.length > 0 ? and(...conditions) : undefined
}

export async function getOverviewAnalytics(filters: AnalyticsFilters) {
  const hasDepartmentFilter = Boolean(filters.department)
  const [row] = hasDepartmentFilter
    ? await db
      .select({
        sessionCount: sum(personnelDepartmentDailyStats.sessionCount),
        actualSum: sum(personnelDepartmentDailyStats.actualMinutesSum),
        expectedSum: sum(personnelDepartmentDailyStats.expectedMinutesSum),
        diffSum: sum(personnelDepartmentDailyStats.diffMinutesSum),
      })
      .from(personnelDepartmentDailyStats)
      .where(buildPersonnelDepartmentStatsWhere(filters))
    : await db
      .select({
        sessionCount: sum(personnelDailyStats.sessionCount),
        actualSum: sum(personnelDailyStats.actualMinutesSum),
        expectedSum: sum(personnelDailyStats.expectedMinutesSum),
        diffSum: sum(personnelDailyStats.diffMinutesSum),
      })
      .from(personnelDailyStats)
      .where(buildPersonnelStatsWhere(filters))

  const totalSessions = Number(row?.sessionCount ?? 0)
  return {
    totalSessions,
    avgExpectedMinutes: avg(Number(row?.expectedSum ?? 0), totalSessions),
    avgActualMinutes: avg(Number(row?.actualSum ?? 0), totalSessions),
    avgDiffMinutes: avg(Number(row?.diffSum ?? 0), totalSessions),
  }
}

export async function getPersonnelAnalytics(filters: AnalyticsFilters) {
  const hasDepartmentFilter = Boolean(filters.department)
  const rows = hasDepartmentFilter
    ? await db
      .select({
        personnelId: personnelDepartmentDailyStats.personnelId,
        personnelName: personnel.fullName,
        sessionCount: sum(personnelDepartmentDailyStats.sessionCount),
        expectedSum: sum(personnelDepartmentDailyStats.expectedMinutesSum),
        actualSum: sum(personnelDepartmentDailyStats.actualMinutesSum),
        diffSum: sum(personnelDepartmentDailyStats.diffMinutesSum),
        perColliSum: sum(personnelDepartmentDailyStats.actualPerColliSum),
        perColliCount: sum(personnelDepartmentDailyStats.actualPerColliCount),
      })
      .from(personnelDepartmentDailyStats)
      .innerJoin(personnel, eq(personnelDepartmentDailyStats.personnelId, personnel.id))
      .where(buildPersonnelDepartmentStatsWhere(filters))
      .groupBy(personnelDepartmentDailyStats.personnelId, personnel.fullName)
    : await db
      .select({
        personnelId: personnelDailyStats.personnelId,
        personnelName: personnel.fullName,
        sessionCount: sum(personnelDailyStats.sessionCount),
        expectedSum: sum(personnelDailyStats.expectedMinutesSum),
        actualSum: sum(personnelDailyStats.actualMinutesSum),
        diffSum: sum(personnelDailyStats.diffMinutesSum),
        perColliSum: sum(personnelDailyStats.actualPerColliSum),
        perColliCount: sum(personnelDailyStats.actualPerColliCount),
      })
      .from(personnelDailyStats)
      .innerJoin(personnel, eq(personnelDailyStats.personnelId, personnel.id))
      .where(buildPersonnelStatsWhere(filters))
      .groupBy(personnelDailyStats.personnelId, personnel.fullName)

  return rows
    .map((row) => {
      const sessionCount = Number(row.sessionCount ?? 0)
      const perColliCount = Number(row.perColliCount ?? 0)
      return {
        personnelId: row.personnelId,
        personnelName: row.personnelName,
        sessionCount,
        avgExpected: avg(Number(row.expectedSum ?? 0), sessionCount),
        avgActual: avg(Number(row.actualSum ?? 0), sessionCount),
        avgDiff: avg(Number(row.diffSum ?? 0), sessionCount),
        avgActualPerColli: perColliCount > 0
          ? Math.round((Number(row.perColliSum ?? 0) / perColliCount) * 100) / 100
          : null,
      }
    })
    .sort((a, b) => (a.avgActualPerColli ?? Infinity) - (b.avgActualPerColli ?? Infinity))
}

export async function getDepartmentAnalytics(filters: AnalyticsFilters) {
  const hasPersonnelFilter = Boolean(filters.personnelId)
  const rows = hasPersonnelFilter
    ? await db
      .select({
        department: personnelDepartmentDailyStats.department,
        sessionCount: sum(personnelDepartmentDailyStats.sessionCount),
        expectedSum: sum(personnelDepartmentDailyStats.expectedMinutesSum),
        actualSum: sum(personnelDepartmentDailyStats.actualMinutesSum),
        diffSum: sum(personnelDepartmentDailyStats.diffMinutesSum),
      })
      .from(personnelDepartmentDailyStats)
      .where(buildPersonnelDepartmentStatsWhere(filters))
      .groupBy(personnelDepartmentDailyStats.department)
    : await db
      .select({
        department: departmentDailyStats.department,
        sessionCount: sum(departmentDailyStats.sessionCount),
        expectedSum: sum(departmentDailyStats.expectedMinutesSum),
        actualSum: sum(departmentDailyStats.actualMinutesSum),
        diffSum: sum(departmentDailyStats.diffMinutesSum),
      })
      .from(departmentDailyStats)
      .where(buildDepartmentStatsWhere(filters))
      .groupBy(departmentDailyStats.department)

  return rows
    .map((row) => {
      const sessionCount = Number(row.sessionCount ?? 0)
      return {
        department: row.department,
        sessionCount,
        avgExpected: avg(Number(row.expectedSum ?? 0), sessionCount),
        avgActual: avg(Number(row.actualSum ?? 0), sessionCount),
        avgDiff: avg(Number(row.diffSum ?? 0), sessionCount),
      }
    })
    .sort((a, b) => b.sessionCount - a.sessionCount)
}

export async function getPersonnelPeriodStats(
  personnelId: string,
  dateFrom?: string | null,
  dateTo?: string | null,
) {
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

export async function getPreviousPersonnelPeriodStats(
  personnelId: string,
  dateFrom?: string | null,
  dateTo?: string | null,
) {
  if (!dateFrom || !dateTo) return null

  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  const periodMs = to.getTime() - from.getTime()
  const prevTo = new Date(from.getTime() - 86400000)
  const prevFrom = new Date(prevTo.getTime() - periodMs)

  return getPersonnelPeriodStats(
    personnelId,
    prevFrom.toISOString().slice(0, 10),
    prevTo.toISOString().slice(0, 10),
  )
}

export async function getPersonnelDepartmentStats(
  personnelId: string,
  dateFrom?: string | null,
  dateTo?: string | null,
) {
  const rows = await getDepartmentAnalytics({ personnelId, dateFrom, dateTo })
  return rows.map(({ department, sessionCount, avgDiff }) => ({
    department,
    sessionCount,
    avgDiff,
  }))
}

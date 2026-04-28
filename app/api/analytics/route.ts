import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  personnel,
  personnelDailyStats,
  departmentDailyStats,
  personnelDepartmentDailyStats,
} from '@/lib/db/schema'
import { roundToOne } from '@/lib/business'
import { eq, and, gte, lte, sum } from 'drizzle-orm'

function avg(totalSum: number, count: number): number | null {
  if (count === 0) return null
  return roundToOne(totalSum / count)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const personnelId = searchParams.get('personnelId')
    const department = searchParams.get('department')

    const hasDepartmentFilter = Boolean(department)
    const hasPersonnelFilter = Boolean(personnelId)

    // Personnel stats conditions
    const pConditions = []
    if (dateFrom) pConditions.push(gte(personnelDailyStats.workDate, dateFrom))
    if (dateTo) pConditions.push(lte(personnelDailyStats.workDate, dateTo))
    if (personnelId) pConditions.push(eq(personnelDailyStats.personnelId, personnelId))
    const pWhere = pConditions.length > 0 ? and(...pConditions) : undefined

    // Personnel+department stats conditions
    const pdConditions = []
    if (dateFrom) pdConditions.push(gte(personnelDepartmentDailyStats.workDate, dateFrom))
    if (dateTo) pdConditions.push(lte(personnelDepartmentDailyStats.workDate, dateTo))
    if (personnelId) pdConditions.push(eq(personnelDepartmentDailyStats.personnelId, personnelId))
    if (department) pdConditions.push(eq(personnelDepartmentDailyStats.department, department))
    const pdWhere = pdConditions.length > 0 ? and(...pdConditions) : undefined

    // Department stats conditions
    const dConditions = []
    if (dateFrom) dConditions.push(gte(departmentDailyStats.workDate, dateFrom))
    if (dateTo) dConditions.push(lte(departmentDailyStats.workDate, dateTo))
    if (department) dConditions.push(eq(departmentDailyStats.department, department))
    const dWhere = dConditions.length > 0 ? and(...dConditions) : undefined

    // Overview from personnel stats
    const [overviewRow] = hasDepartmentFilter
      ? await db
        .select({
          sessionCount: sum(personnelDepartmentDailyStats.sessionCount),
          actualSum: sum(personnelDepartmentDailyStats.actualMinutesSum),
          expectedSum: sum(personnelDepartmentDailyStats.expectedMinutesSum),
          diffSum: sum(personnelDepartmentDailyStats.diffMinutesSum),
        })
        .from(personnelDepartmentDailyStats)
        .where(pdWhere)
      : await db
        .select({
          sessionCount: sum(personnelDailyStats.sessionCount),
          actualSum: sum(personnelDailyStats.actualMinutesSum),
          expectedSum: sum(personnelDailyStats.expectedMinutesSum),
          diffSum: sum(personnelDailyStats.diffMinutesSum),
        })
        .from(personnelDailyStats)
        .where(pWhere)

    const totalSessions = Number(overviewRow?.sessionCount ?? 0)

    if (totalSessions === 0) {
      return Response.json({
        overview: { totalSessions: 0, avgExpectedMinutes: null, avgActualMinutes: null, avgDiffMinutes: null },
        byPersonnel: [],
        byDepartment: [],
      })
    }

    const overview = {
      totalSessions,
      avgExpectedMinutes: avg(Number(overviewRow!.expectedSum ?? 0), totalSessions),
      avgActualMinutes: avg(Number(overviewRow!.actualSum ?? 0), totalSessions),
      avgDiffMinutes: avg(Number(overviewRow!.diffSum ?? 0), totalSessions),
    }

    // By personnel
    const personnelRows = hasDepartmentFilter
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
        .where(pdWhere)
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
        .where(pWhere)
        .groupBy(personnelDailyStats.personnelId, personnel.fullName)

    const byPersonnel = personnelRows
      .map((r) => {
        const count = Number(r.sessionCount ?? 0)
        const perColliCount = Number(r.perColliCount ?? 0)
        return {
          personnelId: r.personnelId,
          personnelName: r.personnelName,
          sessionCount: count,
          avgExpected: avg(Number(r.expectedSum ?? 0), count),
          avgActual: avg(Number(r.actualSum ?? 0), count),
          avgDiff: avg(Number(r.diffSum ?? 0), count),
          avgActualPerColli: perColliCount > 0
            ? Math.round((Number(r.perColliSum ?? 0) / perColliCount) * 100) / 100
            : null,
        }
      })
      .sort((a, b) => (a.avgActualPerColli ?? Infinity) - (b.avgActualPerColli ?? Infinity))

    // By department
    const deptRows = hasPersonnelFilter
      ? await db
        .select({
          department: personnelDepartmentDailyStats.department,
          sessionCount: sum(personnelDepartmentDailyStats.sessionCount),
          expectedSum: sum(personnelDepartmentDailyStats.expectedMinutesSum),
          actualSum: sum(personnelDepartmentDailyStats.actualMinutesSum),
          diffSum: sum(personnelDepartmentDailyStats.diffMinutesSum),
        })
        .from(personnelDepartmentDailyStats)
        .where(pdWhere)
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
        .where(dWhere)
        .groupBy(departmentDailyStats.department)

    const byDepartment = deptRows
      .map((r) => {
        const count = Number(r.sessionCount ?? 0)
        return {
          department: r.department,
          sessionCount: count,
          avgExpected: avg(Number(r.expectedSum ?? 0), count),
          avgActual: avg(Number(r.actualSum ?? 0), count),
          avgDiff: avg(Number(r.diffSum ?? 0), count),
        }
      })
      .sort((a, b) => b.sessionCount - a.sessionCount)

    return Response.json({ overview, byPersonnel, byDepartment })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

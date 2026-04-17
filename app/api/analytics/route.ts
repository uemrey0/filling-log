import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { eq, sql, and, gte, lte, isNotNull, count } from 'drizzle-orm'

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

    // Overview stats
    const [overview] = await db
      .select({
        totalSessions: count(taskSessions.id),
        avgExpectedMinutes: sql<number>`ROUND(AVG(${tasks.expectedMinutes})::numeric, 1)`,
        avgActualMinutes: sql<number>`ROUND((AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60))::numeric, 1)`,
        avgDiffMinutes: sql<number>`ROUND((AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${tasks.expectedMinutes}))::numeric, 1)`,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)

    // By personnel
    const byPersonnel = await db
      .select({
        personnelId: taskSessions.personnelId,
        personnelName: personnel.fullName,
        sessionCount: count(taskSessions.id),
        avgExpected: sql<number>`ROUND(AVG(${tasks.expectedMinutes})::numeric, 1)`,
        avgActual: sql<number>`ROUND((AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60))::numeric, 1)`,
        avgDiff: sql<number>`ROUND((AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${tasks.expectedMinutes}))::numeric, 1)`,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
      .where(whereClause)
      .groupBy(taskSessions.personnelId, personnel.fullName)
      .orderBy(sql`AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${tasks.expectedMinutes})`)

    // By department
    const byDepartment = await db
      .select({
        department: tasks.department,
        sessionCount: count(taskSessions.id),
        avgExpected: sql<number>`ROUND(AVG(${tasks.expectedMinutes})::numeric, 1)`,
        avgActual: sql<number>`ROUND((AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60))::numeric, 1)`,
        avgDiff: sql<number>`ROUND((AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${tasks.expectedMinutes}))::numeric, 1)`,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)
      .groupBy(tasks.department)
      .orderBy(sql`COUNT(${taskSessions.id}) DESC`)

    // Daily overview
    const daily = await db
      .select({
        date: taskSessions.workDate,
        sessionCount: count(taskSessions.id),
        avgDiff: sql<number>`ROUND((AVG(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${tasks.expectedMinutes}))::numeric, 1)`,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(whereClause)
      .groupBy(taskSessions.workDate)
      .orderBy(sql`${taskSessions.workDate} DESC`)
      .limit(30)

    return Response.json({ overview, byPersonnel, byDepartment, daily })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

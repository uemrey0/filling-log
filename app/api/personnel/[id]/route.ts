import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnel, taskSessions, tasks } from '@/lib/db/schema'
import { personnelSchema } from '@/lib/validations'
import { eq, desc, sql, and, gte, lte, isNotNull, count } from 'drizzle-orm'

function buildSessionSelect() {
  return {
    id: taskSessions.id,
    startedAt: taskSessions.startedAt,
    endedAt: taskSessions.endedAt,
    workDate: taskSessions.workDate,
    taskId: taskSessions.taskId,
    department: tasks.department,
    colliCount: tasks.colliCount,
    expectedMinutes: tasks.expectedMinutes,
    actualMinutes: sql<number | null>`
      CASE WHEN ${taskSessions.endedAt} IS NOT NULL
      THEN ROUND((
        EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60
        - COALESCE(${taskSessions.totalPausedMinutes}, 0)
      )::numeric, 1)
      ELSE NULL END`,
    performanceDiff: sql<number | null>`
      CASE WHEN ${taskSessions.endedAt} IS NOT NULL
      THEN ROUND((
        EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60
        - COALESCE(${taskSessions.totalPausedMinutes}, 0)
        - ${tasks.expectedMinutes}
      )::numeric, 1)
      ELSE NULL END`,
  }
}

async function getStats(personnelId: string, dateFrom?: string | null, dateTo?: string | null) {
  const conditions = [
    eq(taskSessions.personnelId, personnelId),
    isNotNull(taskSessions.endedAt),
  ]
  if (dateFrom) conditions.push(gte(taskSessions.workDate, dateFrom))
  if (dateTo) conditions.push(lte(taskSessions.workDate, dateTo))

  const [row] = await db
    .select({
      totalSessions: count(taskSessions.id),
      avgDiff: sql<number | null>`ROUND(AVG(
        EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60
        - COALESCE(${taskSessions.totalPausedMinutes}, 0)
        - ${tasks.expectedMinutes}
      )::numeric, 1)`,
      avgActualPerColli: sql<number | null>`ROUND(AVG(
        (EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60
        - COALESCE(${taskSessions.totalPausedMinutes}, 0))
        / NULLIF(${tasks.colliCount}, 0)
      )::numeric, 2)`,
    })
    .from(taskSessions)
    .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
    .where(and(...conditions))

  return row
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

    const sessions = await db
      .select(buildSessionSelect())
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(and(...sessionConditions))
      .orderBy(desc(taskSessions.startedAt))
      .limit(limit)
      .offset((page - 1) * limit)

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

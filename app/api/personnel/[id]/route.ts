import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnel, taskSessions, tasks } from '@/lib/db/schema'
import { personnelSchema } from '@/lib/validations'
import { eq, desc, sql } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const [person] = await db.select().from(personnel).where(eq(personnel.id, id))
    if (!person) return Response.json({ error: 'Not found' }, { status: 404 })

    const sessions = await db
      .select({
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
          THEN ROUND((EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60)::numeric, 1)
          ELSE NULL END`,
        performanceDiff: sql<number | null>`
          CASE WHEN ${taskSessions.endedAt} IS NOT NULL
          THEN ROUND((EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${tasks.expectedMinutes})::numeric, 1)
          ELSE NULL END`,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(eq(taskSessions.personnelId, id))
      .orderBy(desc(taskSessions.startedAt))
      .limit(100)

    return Response.json({ ...person, sessions })
  } catch {
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

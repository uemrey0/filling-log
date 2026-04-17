import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id))
    if (!task) return Response.json({ error: 'Not found' }, { status: 404 })

    const sessions = await db
      .select({
        id: taskSessions.id,
        personnelId: taskSessions.personnelId,
        personnelName: personnel.fullName,
        startedAt: taskSessions.startedAt,
        endedAt: taskSessions.endedAt,
        workDate: taskSessions.workDate,
        actualMinutes: sql<number | null>`
          CASE WHEN ${taskSessions.endedAt} IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60, 1)
          ELSE NULL END`,
        performanceDiff: sql<number | null>`
          CASE WHEN ${taskSessions.endedAt} IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (${taskSessions.endedAt} - ${taskSessions.startedAt})) / 60 - ${task.expectedMinutes}, 1)
          ELSE NULL END`,
      })
      .from(taskSessions)
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
      .where(eq(taskSessions.taskId, id))

    return Response.json({ ...task, sessions })
  } catch {
    return Response.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

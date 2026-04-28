import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import { refreshAnalyticsForCompletedSessions } from '@/lib/analytics-refresh'
import { eq, isNull, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const endedAt = body.endedAt ? new Date(body.endedAt) : new Date()

    const [updated] = await db
      .update(taskSessions)
      .set({ endedAt, updatedAt: new Date() })
      .where(and(eq(taskSessions.id, id), isNull(taskSessions.endedAt)))
      .returning()

    if (!updated) {
      return Response.json({ error: 'Session not found or already ended' }, { status: 404 })
    }

    const [task] = await db.select({ department: tasks.department }).from(tasks).where(eq(tasks.id, updated.taskId))
    if (task) {
      const workDate = String(updated.workDate).slice(0, 10)
      void refreshAnalyticsForCompletedSessions([
        { personnelId: updated.personnelId, workDate, department: task.department },
      ]).catch(console.error)
    }

    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Failed to end session' }, { status: 500 })
  }
}

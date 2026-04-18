import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const now = new Date()

    const [task] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, id))

    if (!task) {
      return Response.json(
        { error: 'Task not found', code: 'TASK_NOT_FOUND' },
        { status: 404 },
      )
    }

    const activeSessions = await db
      .select({ id: taskSessions.id, isPaused: taskSessions.isPaused })
      .from(taskSessions)
      .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

    if (activeSessions.length === 0) {
      return Response.json(
        { error: 'Task already ended', code: 'TASK_ALREADY_ENDED' },
        { status: 409 },
      )
    }

    const pausableSessionIds = activeSessions
      .filter((session) => !session.isPaused)
      .map((session) => session.id)

    if (pausableSessionIds.length === 0) {
      return Response.json(
        { error: 'Task already paused', code: 'TASK_ALREADY_PAUSED' },
        { status: 409 },
      )
    }

    const updated = await db
      .update(taskSessions)
      .set({ isPaused: true, pausedSince: now, updatedAt: now })
      .where(
        and(
          eq(taskSessions.taskId, id),
          isNull(taskSessions.endedAt),
          eq(taskSessions.isPaused, false),
        ),
      )
      .returning()

    if (updated.length === 0) {
      return Response.json(
        { error: 'Task already paused', code: 'TASK_ALREADY_PAUSED' },
        { status: 409 },
      )
    }

    return Response.json({ paused: updated.length, active: activeSessions.length })
  } catch {
    return Response.json({ error: 'Failed to pause task' }, { status: 500 })
  }
}

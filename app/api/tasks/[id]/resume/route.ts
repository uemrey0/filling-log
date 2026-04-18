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
      .select({ id: taskSessions.id })
      .from(taskSessions)
      .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

    if (activeSessions.length === 0) {
      return Response.json(
        { error: 'Task already ended', code: 'TASK_ALREADY_ENDED' },
        { status: 409 },
      )
    }

    const pausedSessions = await db
      .select()
      .from(taskSessions)
      .where(
        and(
          eq(taskSessions.taskId, id),
          isNull(taskSessions.endedAt),
          eq(taskSessions.isPaused, true),
        ),
      )

    if (pausedSessions.length === 0) {
      return Response.json(
        { error: 'Task is not paused', code: 'TASK_NOT_PAUSED' },
        { status: 409 },
      )
    }

    let resumedCount = 0
    for (const session of pausedSessions) {
      const pausedDurationMinutes = session.pausedSince
        ? Math.max(0, (now.getTime() - session.pausedSince.getTime()) / 60000)
        : 0

      const [updated] = await db
        .update(taskSessions)
        .set({
          isPaused: false,
          pausedSince: null,
          totalPausedMinutes: (session.totalPausedMinutes ?? 0) + pausedDurationMinutes,
          updatedAt: now,
        })
        .where(and(eq(taskSessions.id, session.id), isNull(taskSessions.endedAt)))
        .returning({ id: taskSessions.id })

      if (updated) resumedCount++
    }

    if (resumedCount === 0) {
      return Response.json(
        { error: 'Task already ended', code: 'TASK_ALREADY_ENDED' },
        { status: 409 },
      )
    }

    return Response.json({ resumed: resumedCount, active: activeSessions.length })
  } catch {
    return Response.json({ error: 'Failed to resume task' }, { status: 500 })
  }
}

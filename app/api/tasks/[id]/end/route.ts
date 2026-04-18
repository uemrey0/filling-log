import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const requestedEndedAt = body.endedAt ? new Date(body.endedAt) : new Date()

    if (Number.isNaN(requestedEndedAt.getTime())) {
      return Response.json(
        { error: 'Invalid endedAt', code: 'INVALID_ENDED_AT' },
        { status: 400 },
      )
    }

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
      .select()
      .from(taskSessions)
      .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

    if (activeSessions.length === 0) {
      return Response.json(
        { error: 'Task already ended', code: 'TASK_ALREADY_ENDED' },
        { status: 409 },
      )
    }

    // End each session, accounting for any accumulated pause time
    let endedCount = 0
    for (const session of activeSessions) {
      const endedAt = new Date(Math.max(requestedEndedAt.getTime(), session.startedAt.getTime()))
      let finalPausedMinutes = Math.max(0, session.totalPausedMinutes ?? 0)
      if (session.isPaused && session.pausedSince) {
        const pausedExtraMinutes = Math.max(0, (endedAt.getTime() - session.pausedSince.getTime()) / 60000)
        finalPausedMinutes += pausedExtraMinutes
      }

      const [updated] = await db
        .update(taskSessions)
        .set({
          endedAt,
          isPaused: false,
          pausedSince: null,
          totalPausedMinutes: finalPausedMinutes,
          updatedAt: new Date(),
        })
        .where(and(eq(taskSessions.id, session.id), isNull(taskSessions.endedAt)))
        .returning({ id: taskSessions.id })

      if (updated) endedCount++
    }

    if (endedCount === 0) {
      return Response.json(
        { error: 'Task already ended', code: 'TASK_ALREADY_ENDED' },
        { status: 409 },
      )
    }

    return Response.json({ ended: endedCount })
  } catch {
    return Response.json({ error: 'Failed to end task' }, { status: 500 })
  }
}

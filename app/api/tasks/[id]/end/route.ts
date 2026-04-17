import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const endedAt = body.endedAt ? new Date(body.endedAt) : new Date()

    const activeSessions = await db
      .select()
      .from(taskSessions)
      .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

    if (activeSessions.length === 0) {
      return Response.json({ error: 'Task not found or no active sessions' }, { status: 404 })
    }

    // End each session, accounting for any accumulated pause time
    for (const session of activeSessions) {
      let finalPausedMinutes = session.totalPausedMinutes ?? 0
      if (session.isPaused && session.pausedSince) {
        finalPausedMinutes += (endedAt.getTime() - session.pausedSince.getTime()) / 60000
      }

      await db
        .update(taskSessions)
        .set({
          endedAt,
          isPaused: false,
          pausedSince: null,
          totalPausedMinutes: finalPausedMinutes,
          updatedAt: new Date(),
        })
        .where(eq(taskSessions.id, session.id))
    }

    return Response.json({ ended: activeSessions.length })
  } catch {
    return Response.json({ error: 'Failed to end task' }, { status: 500 })
  }
}

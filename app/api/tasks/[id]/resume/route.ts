import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const now = new Date()

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
      return Response.json({ error: 'No paused sessions found' }, { status: 400 })
    }

    for (const session of pausedSessions) {
      const pausedDurationMinutes = session.pausedSince
        ? (now.getTime() - session.pausedSince.getTime()) / 60000
        : 0

      await db
        .update(taskSessions)
        .set({
          isPaused: false,
          pausedSince: null,
          totalPausedMinutes: (session.totalPausedMinutes ?? 0) + pausedDurationMinutes,
          updatedAt: now,
        })
        .where(eq(taskSessions.id, session.id))
    }

    return Response.json({ resumed: pausedSessions.length })
  } catch {
    return Response.json({ error: 'Failed to resume task' }, { status: 500 })
  }
}

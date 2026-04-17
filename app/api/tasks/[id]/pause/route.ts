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
      return Response.json({ error: 'No active sessions to pause' }, { status: 400 })
    }

    return Response.json({ paused: updated.length })
  } catch {
    return Response.json({ error: 'Failed to pause task' }, { status: 500 })
  }
}

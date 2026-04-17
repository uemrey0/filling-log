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

    // id here is session id
    const [updated] = await db
      .update(taskSessions)
      .set({ endedAt, updatedAt: new Date() })
      .where(and(eq(taskSessions.id, id), isNull(taskSessions.endedAt)))
      .returning()

    if (!updated) {
      return Response.json({ error: 'Session not found or already ended' }, { status: 404 })
    }

    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Failed to end session' }, { status: 500 })
  }
}

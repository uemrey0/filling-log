import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const patchSchema = z.object({
  endedAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const [existing] = await db.select().from(taskSessions).where(eq(taskSessions.id, id))
    if (!existing) {
      return Response.json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' }, { status: 404 })
    }

    const newStartedAt = parsed.data.startedAt ? new Date(parsed.data.startedAt) : existing.startedAt
    const newEndedAt = parsed.data.endedAt ? new Date(parsed.data.endedAt) : existing.endedAt

    if (newEndedAt && newEndedAt.getTime() <= newStartedAt.getTime()) {
      return Response.json(
        { error: 'endedAt must be after startedAt', code: 'INVALID_RANGE' },
        { status: 400 },
      )
    }

    const updates: Partial<typeof existing> = { updatedAt: new Date() }
    if (parsed.data.startedAt) updates.startedAt = newStartedAt
    if (parsed.data.endedAt) updates.endedAt = newEndedAt

    const [updated] = await db
      .update(taskSessions)
      .set(updates)
      .where(eq(taskSessions.id, id))
      .returning()

    return Response.json(updated)
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]]', err)
    return Response.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

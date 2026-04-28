import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import { refreshAnalyticsForCompletedSessions } from '@/lib/analytics-refresh'
import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

const patchSchema = z.object({
  endedAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
})

function toLocalDateIso(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 10)
}

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
    const newWorkDate = parsed.data.startedAt ? toLocalDateIso(newStartedAt) : String(existing.workDate).slice(0, 10)

    if (newEndedAt && newEndedAt.getTime() <= newStartedAt.getTime()) {
      return Response.json(
        { error: 'endedAt must be after startedAt', code: 'INVALID_RANGE' },
        { status: 400 },
      )
    }

    const updates: Partial<typeof existing> = { updatedAt: new Date() }
    if (parsed.data.startedAt) {
      updates.startedAt = newStartedAt
      updates.workDate = newWorkDate
    }
    if (parsed.data.endedAt) updates.endedAt = newEndedAt

    const [updated] = await db
      .update(taskSessions)
      .set(updates)
      .where(eq(taskSessions.id, id))
      .returning()

    if (updated && (parsed.data.startedAt || parsed.data.endedAt)) {
      const [task] = await db
        .select({ department: tasks.department })
        .from(tasks)
        .where(eq(tasks.id, existing.taskId))

      if (task) {
        const completedTaskSessions = await db
          .select({
            personnelId: taskSessions.personnelId,
            workDate: taskSessions.workDate,
          })
          .from(taskSessions)
          .where(and(eq(taskSessions.taskId, existing.taskId), isNotNull(taskSessions.endedAt)))

        const refreshKeys = completedTaskSessions.map((session) => ({
          personnelId: session.personnelId,
          workDate: String(session.workDate).slice(0, 10),
          department: task.department,
        }))

        if (existing.endedAt) {
          refreshKeys.push({
            personnelId: existing.personnelId,
            workDate: String(existing.workDate).slice(0, 10),
            department: task.department,
          })
        }

        if (refreshKeys.length > 0) {
          void refreshAnalyticsForCompletedSessions(refreshKeys).catch(console.error)
        }
      }
    }

    return Response.json(updated)
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]]', err)
    return Response.json({ error: 'Failed to update session' }, { status: 500 })
  }
}

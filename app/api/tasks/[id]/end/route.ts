import { NextRequest } from 'next/server'
import { withTransaction } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import { calcExpectedMinutes, todayDate } from '@/lib/business'
import { refreshAnalyticsForCompletedSessions } from '@/lib/analytics-refresh'
import { eq, isNull, and } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '@/lib/db/schema'
import type { ClientBase } from 'pg'
import type { NodePgClient } from 'drizzle-orm/node-postgres'

type EndedSession = { personnelId: string; workDate: string; department: string }

type EndResult =
  | { kind: 'ok'; ended: number; continuationTaskId: string | null; endedSessions: EndedSession[] }
  | { kind: 'not_found' }
  | { kind: 'already_ended' }
  | { kind: 'invalid_remaining' }
  | { kind: 'invalid_session_end' }
  | { kind: 'invalid_continuation' }

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

    let remainingColli: number | null = null
    if (body.remainingColli !== undefined && body.remainingColli !== null) {
      const raw = body.remainingColli
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
        return Response.json(
          { error: 'Invalid remainingColli', code: 'INVALID_INPUT' },
          { status: 400 },
        )
      }
      remainingColli = raw
    }

    const sessionEndsInput: { sessionId: string; endedAt: string }[] = Array.isArray(body.sessionEnds)
      ? body.sessionEnds
      : []
    const sessionEndsMap = new Map<string, Date>()
    for (const entry of sessionEndsInput) {
      if (!entry || typeof entry.sessionId !== 'string' || typeof entry.endedAt !== 'string') {
        return Response.json(
          { error: 'Invalid sessionEnds entry', code: 'INVALID_INPUT' },
          { status: 400 },
        )
      }
      const d = new Date(entry.endedAt)
      if (Number.isNaN(d.getTime())) {
        return Response.json(
          { error: 'Invalid session endedAt', code: 'INVALID_ENDED_AT' },
          { status: 400 },
        )
      }
      sessionEndsMap.set(entry.sessionId, d)
    }

    const continuingPersonnelIds: string[] = Array.isArray(body.continuingPersonnelIds)
      ? body.continuingPersonnelIds.filter((x: unknown): x is string => typeof x === 'string')
      : []
    const continuingSet = new Set(continuingPersonnelIds)

    const result = await withTransaction(async (client: ClientBase): Promise<EndResult> => {
      const txDb = drizzle(client as unknown as NodePgClient, { schema })

      const [task] = await txDb.select().from(tasks).where(eq(tasks.id, id))
      if (!task) return { kind: 'not_found' }

      const activeSessions = await txDb
        .select()
        .from(taskSessions)
        .where(and(eq(taskSessions.taskId, id), isNull(taskSessions.endedAt)))

      if (activeSessions.length === 0) return { kind: 'already_ended' }

      if (remainingColli !== null && remainingColli >= task.colliCount) {
        return { kind: 'invalid_remaining' }
      }

      const activeSessionIds = new Set(activeSessions.map((s) => s.id))
      for (const sid of sessionEndsMap.keys()) {
        if (!activeSessionIds.has(sid)) return { kind: 'invalid_session_end' }
      }

      const continuingActiveSessions = activeSessions.filter((s) => continuingSet.has(s.personnelId))
      const endingActiveSessions = activeSessions.filter((s) => !continuingSet.has(s.personnelId))

      const hasContinuation =
        continuingActiveSessions.length > 0 &&
        remainingColli !== null &&
        remainingColli > 0 &&
        endingActiveSessions.length > 0

      if (continuingActiveSessions.length > 0 && (remainingColli === null || remainingColli <= 0)) {
        return { kind: 'invalid_continuation' }
      }
      if (continuingActiveSessions.length > 0 && endingActiveSessions.length === 0) {
        return { kind: 'invalid_continuation' }
      }

      const transitionTime = new Date()

      let endedCount = 0
      for (const session of activeSessions) {
        const isContinuing = continuingSet.has(session.personnelId)
        const rawEnd = isContinuing
          ? transitionTime
          : sessionEndsMap.get(session.id) ?? requestedEndedAt
        const endedAt = new Date(Math.max(rawEnd.getTime(), session.startedAt.getTime()))

        let finalPausedMinutes = Math.max(0, session.totalPausedMinutes ?? 0)
        if (session.isPaused && session.pausedSince) {
          const pausedExtraMinutes = Math.max(0, (endedAt.getTime() - session.pausedSince.getTime()) / 60000)
          finalPausedMinutes += pausedExtraMinutes
        }

        const [updated] = await txDb
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

      if (endedCount === 0) return { kind: 'already_ended' }

      let continuationTaskId: string | null = null

      if (remainingColli !== null && remainingColli > 0) {
        const newColliCount = task.colliCount - remainingColli
        const doneByCount = Math.max(1, endingActiveSessions.length || activeSessions.length)
        const newExpectedMinutes = calcExpectedMinutes(
          newColliCount,
          doneByCount,
          task.discountContainer,
        )
        await txDb
          .update(tasks)
          .set({
            colliCount: newColliCount,
            expectedMinutes: newExpectedMinutes,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, id))

        if (hasContinuation) {
          const [continuationTask] = await txDb
            .insert(tasks)
            .values({
              department: task.department,
              discountContainer: task.discountContainer,
              colliCount: remainingColli,
              expectedMinutes: calcExpectedMinutes(
                remainingColli,
                continuingActiveSessions.length,
                task.discountContainer,
              ),
              notes: task.notes,
            })
            .returning()

          const workDate = todayDate()
          for (const cont of continuingActiveSessions) {
            await txDb.insert(taskSessions).values({
              taskId: continuationTask.id,
              personnelId: cont.personnelId,
              startedAt: transitionTime,
              workDate,
            })
          }
          continuationTaskId = continuationTask.id
        }
      }

      const endedSessions: EndedSession[] = activeSessions.map((s) => ({
        personnelId: s.personnelId,
        workDate: String(s.workDate).slice(0, 10),
        department: task.department,
      }))

      return { kind: 'ok', ended: endedCount, continuationTaskId, endedSessions }
    })

    if (result.kind === 'not_found') {
      return Response.json({ error: 'Task not found', code: 'TASK_NOT_FOUND' }, { status: 404 })
    }
    if (result.kind === 'already_ended') {
      return Response.json({ error: 'Task already ended', code: 'TASK_ALREADY_ENDED' }, { status: 409 })
    }
    if (result.kind === 'invalid_remaining') {
      return Response.json({ error: 'Invalid remainingColli', code: 'INVALID_INPUT' }, { status: 400 })
    }
    if (result.kind === 'invalid_session_end') {
      return Response.json({ error: 'Invalid sessionEnds entry', code: 'INVALID_INPUT' }, { status: 400 })
    }
    if (result.kind === 'invalid_continuation') {
      return Response.json({ error: 'Invalid continuation setup', code: 'INVALID_INPUT' }, { status: 400 })
    }

    void refreshAnalyticsForCompletedSessions(result.endedSessions).catch(console.error)

    return Response.json({ ended: result.ended, continuationTaskId: result.continuationTaskId })
  } catch {
    return Response.json({ error: 'Failed to end task' }, { status: 500 })
  }
}

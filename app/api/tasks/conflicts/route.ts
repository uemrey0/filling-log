import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { tasks, taskSessions, personnel } from '@/lib/db/schema'
import { eq, isNull, and, inArray } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const ids = request.nextUrl.searchParams.get('personnelIds')
    if (!ids) return Response.json([])

    const personnelIds = ids.split(',').filter(Boolean)
    if (personnelIds.length === 0) return Response.json([])

    const activeSessions = await db
      .select({
        sessionId: taskSessions.id,
        taskId: taskSessions.taskId,
        personnelId: taskSessions.personnelId,
        personnelName: personnel.fullName,
        startedAt: taskSessions.startedAt,
        department: tasks.department,
        colliCount: tasks.colliCount,
        expectedMinutes: tasks.expectedMinutes,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .innerJoin(personnel, eq(taskSessions.personnelId, personnel.id))
      .where(and(isNull(taskSessions.endedAt), inArray(taskSessions.personnelId, personnelIds)))

    return Response.json(activeSessions)
  } catch {
    return Response.json({ error: 'Failed to check conflicts' }, { status: 500 })
  }
}

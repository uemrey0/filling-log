import { db } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import { refreshAnalyticsForCompletedSessions } from '@/lib/analytics-refresh'
import { isNotNull, eq } from 'drizzle-orm'

// POST /api/admin/backfill-stats
// One-time call to populate daily stats tables from existing session history.
export async function POST() {
  try {
    const rows = await db
      .select({
        personnelId: taskSessions.personnelId,
        workDate: taskSessions.workDate,
        department: tasks.department,
      })
      .from(taskSessions)
      .innerJoin(tasks, eq(taskSessions.taskId, tasks.id))
      .where(isNotNull(taskSessions.endedAt))
      .groupBy(taskSessions.personnelId, taskSessions.workDate, tasks.department)

    const keys = rows.map((row) => ({
      personnelId: row.personnelId,
      workDate: String(row.workDate).slice(0, 10),
      department: row.department,
    }))

    await refreshAnalyticsForCompletedSessions(keys)

    return Response.json({ ok: true, rows: keys.length })
  } catch (err) {
    console.error('[POST /api/admin/backfill-stats]', err)
    return Response.json({ error: 'Backfill failed' }, { status: 500 })
  }
}

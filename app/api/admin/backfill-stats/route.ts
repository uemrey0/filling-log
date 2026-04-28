import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { taskSessions, tasks } from '@/lib/db/schema'
import { refreshPersonnelDailyStats, refreshDepartmentDailyStats } from '@/lib/analytics-refresh'
import { isNotNull, eq } from 'drizzle-orm'

// POST /api/admin/backfill-stats
// One-time call to populate daily stats tables from existing session history.
export async function POST(_request: NextRequest) {
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

    const seenPersonnel = new Set<string>()
    const seenDept = new Set<string>()
    const personnelKeys: { personnelId: string; workDate: string }[] = []
    const deptKeys: { workDate: string; department: string }[] = []

    for (const row of rows) {
      const workDate = String(row.workDate).slice(0, 10)

      const pk = `${row.personnelId}|${workDate}`
      if (!seenPersonnel.has(pk)) { seenPersonnel.add(pk); personnelKeys.push({ personnelId: row.personnelId, workDate }) }

      const dk = `${workDate}|${row.department}`
      if (!seenDept.has(dk)) { seenDept.add(dk); deptKeys.push({ workDate, department: row.department }) }
    }

    await refreshPersonnelDailyStats(personnelKeys)
    await refreshDepartmentDailyStats(deptKeys)

    return Response.json({ ok: true, personnel: personnelKeys.length, departments: deptKeys.length })
  } catch (err) {
    console.error('[POST /api/admin/backfill-stats]', err)
    return Response.json({ error: 'Backfill failed' }, { status: 500 })
  }
}

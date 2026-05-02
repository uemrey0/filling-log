import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getPersonnelAnalytics } from '@/lib/analytics-queries'

function parseDateParam(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const session = await auth.api.getSession({ headers: request.headers })
    const byPersonnel = await getPersonnelAnalytics({
      dateFrom: parseDateParam(searchParams.get('dateFrom')),
      dateTo: parseDateParam(searchParams.get('dateTo')),
      personnelId: null,
      department: null,
    })

    return Response.json({
      byPersonnel: byPersonnel.map((row) => ({
        personnelId: session ? row.personnelId : null,
        personnelName: row.personnelName,
        sessionCount: row.sessionCount,
        avgActualPerColli: row.avgActualPerColli,
      })),
    })
  } catch (err) {
    console.error('[GET /api/leaderboard]', err)
    return Response.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}

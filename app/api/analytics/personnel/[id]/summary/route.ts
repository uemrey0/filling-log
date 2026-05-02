import { NextRequest } from 'next/server'
import {
  getPersonnelPeriodStats,
  getPreviousPersonnelPeriodStats,
} from '@/lib/analytics-queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const [stats, prevStats] = await Promise.all([
      getPersonnelPeriodStats(id, dateFrom, dateTo),
      getPreviousPersonnelPeriodStats(id, dateFrom, dateTo),
    ])

    return Response.json({ stats, prevStats })
  } catch (err) {
    console.error('[GET /api/analytics/personnel/[id]/summary]', err)
    return Response.json({ error: 'Failed to fetch personnel summary analytics' }, { status: 500 })
  }
}

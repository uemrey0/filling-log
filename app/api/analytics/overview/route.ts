import { NextRequest } from 'next/server'
import { getOverviewAnalytics } from '@/lib/analytics-queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const overview = await getOverviewAnalytics({
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      personnelId: searchParams.get('personnelId'),
      department: searchParams.get('department'),
    })

    return Response.json({ overview })
  } catch (err) {
    console.error('[GET /api/analytics/overview]', err)
    return Response.json({ error: 'Failed to fetch analytics overview' }, { status: 500 })
  }
}

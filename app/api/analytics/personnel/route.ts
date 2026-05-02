import { NextRequest } from 'next/server'
import { getPersonnelAnalytics } from '@/lib/analytics-queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const byPersonnel = await getPersonnelAnalytics({
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      personnelId: searchParams.get('personnelId'),
      department: searchParams.get('department'),
    })

    return Response.json({ byPersonnel })
  } catch (err) {
    console.error('[GET /api/analytics/personnel]', err)
    return Response.json({ error: 'Failed to fetch personnel analytics' }, { status: 500 })
  }
}

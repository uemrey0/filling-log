import { NextRequest } from 'next/server'
import { getDepartmentAnalytics } from '@/lib/analytics-queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const byDepartment = await getDepartmentAnalytics({
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      personnelId: searchParams.get('personnelId'),
      department: searchParams.get('department'),
    })

    return Response.json({ byDepartment })
  } catch (err) {
    console.error('[GET /api/analytics/departments]', err)
    return Response.json({ error: 'Failed to fetch department analytics' }, { status: 500 })
  }
}

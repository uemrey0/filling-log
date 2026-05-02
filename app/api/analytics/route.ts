import { NextRequest } from 'next/server'
import {
  getDepartmentAnalytics,
  getOverviewAnalytics,
  getPersonnelAnalytics,
} from '@/lib/analytics-queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const filters = {
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      personnelId: searchParams.get('personnelId'),
      department: searchParams.get('department'),
    }

    const [overview, byPersonnel, byDepartment] = await Promise.all([
      getOverviewAnalytics(filters),
      getPersonnelAnalytics(filters),
      getDepartmentAnalytics(filters),
    ])

    return Response.json({ overview, byPersonnel, byDepartment })
  } catch (err) {
    console.error('[GET /api/analytics]', err)
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

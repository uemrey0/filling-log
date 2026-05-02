import { NextRequest } from 'next/server'
import { getPersonnelDepartmentStats } from '@/lib/analytics-queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = request.nextUrl
    const departmentStats = await getPersonnelDepartmentStats(
      id,
      searchParams.get('dateFrom'),
      searchParams.get('dateTo'),
    )

    return Response.json({ departmentStats })
  } catch (err) {
    console.error('[GET /api/analytics/personnel/[id]/departments]', err)
    return Response.json({ error: 'Failed to fetch personnel department analytics' }, { status: 500 })
  }
}

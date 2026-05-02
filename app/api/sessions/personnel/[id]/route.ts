import { NextRequest } from 'next/server'
import { getPersonnelSessions } from '@/lib/session-queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

    const result = await getPersonnelSessions(id, {
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      page,
      limit,
    })

    return Response.json(result)
  } catch (err) {
    console.error('[GET /api/sessions/personnel/[id]]', err)
    return Response.json({ error: 'Failed to fetch personnel sessions' }, { status: 500 })
  }
}

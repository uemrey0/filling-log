import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnelComments, personnel } from '@/lib/db/schema'
import { eq, desc, count } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
    const offset = (page - 1) * limit

    const [person] = await db.select({ id: personnel.id }).from(personnel).where(eq(personnel.id, id))
    if (!person) return Response.json({ error: 'Not found' }, { status: 404 })

    const rows = await db
      .select()
      .from(personnelComments)
      .where(eq(personnelComments.personnelId, id))
      .orderBy(desc(personnelComments.createdAt))
      .limit(limit)
      .offset(offset)

    const [{ total }] = await db
      .select({ total: count() })
      .from(personnelComments)
      .where(eq(personnelComments.personnelId, id))

    return Response.json({ comments: rows, total: Number(total), page, limit })
  } catch {
    return Response.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const content = typeof body.content === 'string' ? body.content.trim() : ''

    if (!content || content.length < 1 || content.length > 2000) {
      return Response.json({ error: 'Invalid content' }, { status: 400 })
    }

    const [person] = await db.select({ id: personnel.id }).from(personnel).where(eq(personnel.id, id))
    if (!person) return Response.json({ error: 'Not found' }, { status: 404 })

    const [comment] = await db
      .insert(personnelComments)
      .values({ personnelId: id, content })
      .returning()

    return Response.json(comment, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to save comment' }, { status: 500 })
  }
}

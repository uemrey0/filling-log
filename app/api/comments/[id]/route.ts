import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnelComments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const [deleted] = await db
      .delete(personnelComments)
      .where(eq(personnelComments.id, id))
      .returning({ id: personnelComments.id })

    if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json({ deleted: true })
  } catch {
    return Response.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}

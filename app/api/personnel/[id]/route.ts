import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnel } from '@/lib/db/schema'
import { personnelSchema } from '@/lib/validations'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const [person] = await db.select().from(personnel).where(eq(personnel.id, id))

    if (!person) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(person)
  } catch (err) {
    console.error('[GET /api/personnel/[id]]', err)
    return Response.json({ error: 'Failed to fetch personnel' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const parsed = personnelSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const [updated] = await db
      .update(personnel)
      .set({
        fullName: parsed.data.fullName,
        isActive: parsed.data.isActive ?? true,
        notes: parsed.data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(personnel.id, id))
      .returning()

    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Failed to update personnel' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const [updated] = await db
      .update(personnel)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(personnel.id, id))
      .returning()

    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Failed to deactivate personnel' }, { status: 500 })
  }
}

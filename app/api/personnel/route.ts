import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnel } from '@/lib/db/schema'
import { personnelSchema } from '@/lib/validations'
import { eq, asc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const activeOnly = searchParams.get('active') === 'true'

    const query = db.select().from(personnel)
    const rows = activeOnly
      ? await query.where(eq(personnel.isActive, true)).orderBy(asc(personnel.fullName))
      : await query.orderBy(asc(personnel.fullName))

    return Response.json(rows)
  } catch {
    return Response.json({ error: 'Failed to fetch personnel' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = personnelSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const [created] = await db
      .insert(personnel)
      .values({
        fullName: parsed.data.fullName,
        isActive: parsed.data.isActive ?? true,
        notes: parsed.data.notes ?? null,
      })
      .returning()

    return Response.json(created, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to create personnel' }, { status: 500 })
  }
}

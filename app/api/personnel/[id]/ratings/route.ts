import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { personnelRatings, personnel } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const [person] = await db
      .select({
        id: personnel.id,
        ratingCount: personnel.ratingCount,
        avgWorkEthic: personnel.avgWorkEthic,
        avgQuality: personnel.avgQuality,
        avgTeamwork: personnel.avgTeamwork,
        avgOverall: personnel.avgOverall,
      })
      .from(personnel)
      .where(eq(personnel.id, id))

    if (!person) return Response.json({ error: 'Not found' }, { status: 404 })

    return Response.json({
      ratingCount: person.ratingCount,
      avgWorkEthic: person.avgWorkEthic,
      avgQuality: person.avgQuality,
      avgTeamwork: person.avgTeamwork,
      avgOverall: person.avgOverall,
    })
  } catch {
    return Response.json({ error: 'Failed to fetch ratings' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const workEthicScore = Number(body.workEthicScore)
    const qualityScore = Number(body.qualityScore)
    const teamworkScore = Number(body.teamworkScore)

    if (
      !Number.isInteger(workEthicScore) || workEthicScore < 1 || workEthicScore > 5 ||
      !Number.isInteger(qualityScore) || qualityScore < 1 || qualityScore > 5 ||
      !Number.isInteger(teamworkScore) || teamworkScore < 1 || teamworkScore > 5
    ) {
      return Response.json({ error: 'Scores must be integers between 1 and 5' }, { status: 400 })
    }

    const taskId = typeof body.taskId === 'string' && body.taskId.length > 0 ? body.taskId : null
    const comment = typeof body.comment === 'string' && body.comment.trim().length > 0
      ? body.comment.trim()
      : null

    const [person] = await db
      .select({
        id: personnel.id,
        ratingCount: personnel.ratingCount,
        avgWorkEthic: personnel.avgWorkEthic,
        avgQuality: personnel.avgQuality,
        avgTeamwork: personnel.avgTeamwork,
      })
      .from(personnel)
      .where(eq(personnel.id, id))

    if (!person) return Response.json({ error: 'Not found' }, { status: 404 })

    const [rating] = await db
      .insert(personnelRatings)
      .values({ personnelId: id, taskId, workEthicScore, qualityScore, teamworkScore, comment })
      .returning()

    // Incremental cache update — no full aggregation query needed
    const n = person.ratingCount + 1
    const newAvgWorkEthic = ((person.avgWorkEthic ?? 0) * person.ratingCount + workEthicScore) / n
    const newAvgQuality = ((person.avgQuality ?? 0) * person.ratingCount + qualityScore) / n
    const newAvgTeamwork = ((person.avgTeamwork ?? 0) * person.ratingCount + teamworkScore) / n
    const newAvgOverall = (newAvgWorkEthic + newAvgQuality + newAvgTeamwork) / 3

    await db
      .update(personnel)
      .set({
        ratingCount: n,
        avgWorkEthic: newAvgWorkEthic,
        avgQuality: newAvgQuality,
        avgTeamwork: newAvgTeamwork,
        avgOverall: newAvgOverall,
        updatedAt: new Date(),
      })
      .where(eq(personnel.id, id))

    return Response.json(rating, { status: 201 })
  } catch {
    return Response.json({ error: 'Failed to save rating' }, { status: 500 })
  }
}

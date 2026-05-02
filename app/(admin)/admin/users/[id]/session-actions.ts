'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authSessions } from '@/lib/db/schema'
import { getCurrentSession } from '@/lib/auth-server'

export async function revokeSession(sessionId: string) {
  const session = await getCurrentSession()
  if (!session || session.user.role !== 'admin') throw new Error('Unauthorized')
  await db.delete(authSessions).where(eq(authSessions.id, sessionId))
}

'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { authUsers } from '@/lib/db/schema'
import { getCurrentSession } from '@/lib/auth-server'

export type UpdateUserData = {
  name: string
  email: string
  username: string
}

export async function updateUser(userId: string, data: UpdateUserData) {
  const session = await getCurrentSession()
  if (!session || session.user.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const normalizedUsername = data.username.trim().toLowerCase()
  const displayUsername = data.username.trim()

  await db
    .update(authUsers)
    .set({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      username: normalizedUsername,
      displayUsername,
      updatedAt: new Date(),
    })
    .where(eq(authUsers.id, userId))

  revalidatePath(`/admin/users/${userId}`)
}

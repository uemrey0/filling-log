import { headers } from 'next/headers'
import { auth } from './auth'

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  })
}

export type CurrentSession = Awaited<ReturnType<typeof getCurrentSession>>

export function isAdminSession(session: CurrentSession) {
  return session?.user.role === 'admin'
}

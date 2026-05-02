import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth-server'
import { WelcomeScreen } from './welcome-screen'

export default async function Root() {
  const session = await getCurrentSession()
  if (session) redirect('/dashboard')

  return <WelcomeScreen />
}

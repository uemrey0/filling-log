import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth-server'
import { SignInForm } from './sign-in-form'

type SignInPageProps = {
  searchParams?: Promise<{
    callbackURL?: string
  }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getCurrentSession()
  if (session) redirect('/dashboard')

  const params = await searchParams
  return <SignInForm callbackURL={params?.callbackURL ?? '/dashboard'} />
}

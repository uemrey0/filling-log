import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth-server'
import { AdminShell } from './admin-shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()

  if (!session) {
    redirect('/sign-in?callbackURL=/admin')
  }

  if (session.user.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <AdminShell userName={session.user.name} userRole={session.user.role ?? 'admin'}>
      {children}
    </AdminShell>
  )
}

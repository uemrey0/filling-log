import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { db } from '@/lib/db'
import { authUsers } from '@/lib/db/schema'
import { getUserUsername } from '../../../admin-types'
import { EditUserForm } from './edit-user-form'

type EditUserPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: EditUserPageProps) {
  const { id } = await params
  const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id)).limit(1)

  if (!user) notFound()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Edit user"
        subtitle={`${getUserUsername(user)} · ${user.email}`}
        back={
          <Link href={`/admin/users/${id}`}>
            <Button type="button" variant="secondary" size="sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          </Link>
        }
      />
      <EditUserForm
        userId={id}
        initialName={user.name}
        initialEmail={user.email}
        initialUsername={user.displayUsername ?? user.username ?? ''}
      />
    </div>
  )
}

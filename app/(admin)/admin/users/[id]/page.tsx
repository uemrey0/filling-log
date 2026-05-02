import Link from 'next/link'
import { notFound } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { db } from '@/lib/db'
import { authSessions, authUsers } from '@/lib/db/schema'
import { getCurrentSession } from '@/lib/auth-server'
import { formatAdminDateTime, getUserUsername } from '../../admin-types'
import { UserActions } from './user-actions'
import { RevokeSessionButton } from './revoke-session-button'

type UserDetailPageProps = {
  params: Promise<{ id: string }>
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function getBrowser(userAgent: string | null) {
  if (!userAgent) return 'Unknown'
  const edge = userAgent.match(/Edg\/([\d.]+)/)
  if (edge) return `Edge ${edge[1]}`
  const chrome = userAgent.match(/Chrome\/([\d.]+)/)
  if (chrome && !userAgent.includes('Chromium')) return `Chrome ${chrome[1]}`
  const firefox = userAgent.match(/Firefox\/([\d.]+)/)
  if (firefox) return `Firefox ${firefox[1]}`
  const safari = userAgent.match(/Version\/([\d.]+).*Safari/)
  if (safari) return `Safari ${safari[1]}`
  return 'Unknown'
}

function getOperatingSystem(userAgent: string | null) {
  if (!userAgent) return 'Unknown'
  if (userAgent.includes('Windows NT 10')) return 'Windows 10/11'
  if (userAgent.includes('Windows NT')) return 'Windows'
  const mac = userAgent.match(/Mac OS X ([\d_]+)/)
  if (mac) return `macOS ${mac[1].replaceAll('_', '.')}`
  const ios = userAgent.match(/(?:iPhone OS|CPU OS) ([\d_]+)/)
  if (ios) return `iOS ${ios[1].replaceAll('_', '.')}`
  const android = userAgent.match(/Android ([\d.]+)/)
  if (android) return `Android ${android[1]}`
  if (userAgent.includes('Linux')) return 'Linux'
  return 'Unknown'
}

function getDevice(userAgent: string | null) {
  if (!userAgent) return 'Unknown'
  if (/bot|crawler|spider|crawling/i.test(userAgent)) return 'Bot'
  if (/iPad|Tablet/i.test(userAgent)) return 'Tablet'
  if (/Mobi|iPhone|Android/i.test(userAgent)) return 'Mobile'
  return 'Desktop'
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-gray-900">{value || '-'}</div>
    </div>
  )
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params
  const [user, session] = await Promise.all([
    db.select().from(authUsers).where(eq(authUsers.id, id)).limit(1).then((r) => r[0]),
    getCurrentSession(),
  ])

  if (!user) notFound()

  const isCurrentUser = session?.user.id === id

  const sessions = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.userId, id))
    .orderBy(desc(authSessions.updatedAt))
    .limit(50)

  const now = Date.now()
  const activeSessions = sessions.filter((s) => s.expiresAt.getTime() > now)
  const expiredSessions = sessions.length - activeSessions.length
  const latestSession = sessions[0]

  return (
    <div className="space-y-5">
      <PageHeader
        title={user.name}
        subtitle={`${getUserUsername(user)} · ${user.email}`}
        back={
          <Link href="/admin/users">
            <Button type="button" variant="secondary" size="sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          </Link>
        }
        action={
          <Link href={`/admin/users/${id}/edit`}>
            <Button type="button" variant="secondary" size="sm">
              Edit
            </Button>
          </Link>
        }
      />

      {/* User info + actions */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card padding="lg">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#80BC17]/15 text-lg font-bold text-[#1C7745]">
              {initials(user.name || user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold text-gray-950">{user.name}</h2>
                <Badge variant={user.role === 'admin' ? 'purple' : 'gray'}>{user.role}</Badge>
                {user.banned && <Badge variant="red">banned</Badge>}
                {user.emailVerified && <Badge variant="green">verified email</Badge>}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Username" value={getUserUsername(user)} />
                <DetailItem label="Created" value={formatAdminDateTime(user.createdAt)} />
                <DetailItem label="Updated" value={formatAdminDateTime(user.updatedAt)} />
                <DetailItem label="Ban reason" value={user.banReason ?? '-'} />
              </div>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Actions</div>
          <UserActions user={user} isCurrentUser={isCurrentUser} />
        </Card>
      </div>

      {/* Sessions */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Sessions</h2>
          <span className="text-xs font-semibold text-gray-400">Showing latest {sessions.length}</span>
        </div>

        {/* Session stats */}
        <div className="mb-3 grid grid-cols-3 gap-3">
          <Card padding="md">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Active</div>
            <div className="mt-2 text-2xl font-bold text-[#1C7745]">{activeSessions.length}</div>
          </Card>
          <Card padding="md">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Expired</div>
            <div className="mt-2 text-2xl font-bold text-gray-950">{expiredSessions}</div>
          </Card>
          <Card padding="md">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Last active</div>
            <div className="mt-2 text-sm font-bold leading-snug text-gray-950">{formatAdminDateTime(latestSession?.updatedAt)}</div>
          </Card>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <div className="py-8 text-center text-sm font-semibold text-gray-500">No sessions recorded for this user.</div>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s, index) => {
              const active = s.expiresAt.getTime() > now
              const browser = getBrowser(s.userAgent)
              const os = getOperatingSystem(s.userAgent)
              const device = getDevice(s.userAgent)

              return (
                <Card key={s.id} padding="md">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-bold text-gray-950">Session {index + 1}</div>
                        <Badge variant={active ? 'green' : 'gray'}>{active ? 'active' : 'expired'}</Badge>
                        {s.impersonatedBy && <Badge variant="orange">impersonated</Badge>}
                        <RevokeSessionButton sessionId={s.id} />
                      </div>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailItem label="IP address" value={s.ipAddress ?? '-'} />
                        <DetailItem label="Device" value={device} />
                        <DetailItem label="Browser" value={browser} />
                        <DetailItem label="OS" value={os} />
                        <DetailItem label="Created" value={formatAdminDateTime(s.createdAt)} />
                        <DetailItem label="Updated" value={formatAdminDateTime(s.updatedAt)} />
                        <DetailItem label="Expires" value={formatAdminDateTime(s.expiresAt)} />
                      </div>
                    </div>

                    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-widest text-gray-400">User agent</div>
                      <p className="mt-2 break-words font-mono text-xs leading-relaxed text-gray-700">
                        {s.userAgent ?? '-'}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

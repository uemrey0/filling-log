'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { AdminUser, formatAdminDate, getUserUsername } from '../admin-types'

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const result = await authClient.admin.listUsers({
      query: {
        limit: 100,
        offset: 0,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error.message || 'Failed to load users')
      return
    }

    setUsers((result.data?.users ?? []) as AdminUser[])
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadUsers()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users

    return users.filter((user) => {
      return [user.name, user.email, user.username, user.displayUsername, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [query, users])

  const activeCount = users.filter((user) => !user.banned).length
  const adminCount = users.filter((user) => user.role === 'admin').length
  const bannedCount = users.filter((user) => user.banned).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        action={
          <Link href="/admin/users/new">
            <Button size="md">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New user
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Card padding="md">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Total</div>
          <div className="mt-2 text-2xl font-bold text-gray-950">{users.length}</div>
        </Card>
        <Card padding="md">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Active</div>
          <div className="mt-2 text-2xl font-bold text-[#1C7745]">{activeCount}</div>
        </Card>
        <Card padding="md">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Admins</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-950">{adminCount}</span>
            {bannedCount > 0 && <span className="text-xs font-semibold text-[#E40B17]">{bannedCount} banned</span>}
          </div>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Input label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, username, or role" />
          <Button type="button" variant="secondary" onClick={() => void loadUsers()}>
            Refresh
          </Button>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid gap-3 p-4 md:grid-cols-[1fr_140px_104px] md:items-center">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))
          ) : filteredUsers.length === 0 ? (
              <div className="px-4 py-14 text-center text-sm font-semibold text-gray-500">No users found.</div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="grid gap-3 p-4 transition-colors hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_140px_104px] md:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#80BC17]/15 text-sm font-bold text-[#1C7745]">
                      {initials(user.name || user.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-bold text-gray-950">{user.name}</div>
                        <Badge variant={user.role === 'admin' ? 'purple' : 'gray'}>{user.role ?? 'user'}</Badge>
                        {user.banned && <Badge variant="red">banned</Badge>}
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-gray-500">
                        {getUserUsername(user)} · {user.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-400">
                    <span className="md:hidden">Created </span>{formatAdminDate(user.createdAt)}
                  </div>
                  <Link href={`/admin/users/${user.id}`} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-[#80BC17] hover:text-[#1C7745]">
                    Details
                  </Link>
                </div>
              ))
            )}
        </div>
      </Card>
    </div>
  )
}

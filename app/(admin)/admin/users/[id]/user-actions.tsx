'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/Button'
import { AdminUser, generateHiddenPassword } from '../../admin-types'

type UserActionsProps = {
  user: AdminUser
  isCurrentUser: boolean
}

const iconRole = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)

const iconPassword = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const iconBan = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
)

const iconDelete = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

export function UserActions({ user, isCurrentUser }: UserActionsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const updateRole = async (nextRole: 'user' | 'admin') => {
    if ((user.role ?? 'user') === nextRole) return
    setBusy(true)
    const result = await authClient.admin.setRole({ userId: user.id, role: nextRole })
    setBusy(false)
    if (result.error) {
      toast.error(result.error.message || 'Failed to update role')
      return
    }
    toast.success('Role updated')
    router.refresh()
  }

  const toggleBan = async () => {
    setBusy(true)
    const result = user.banned
      ? await authClient.admin.unbanUser({ userId: user.id })
      : await authClient.admin.banUser({ userId: user.id, banReason: 'Disabled by admin' })
    setBusy(false)
    if (result.error) {
      toast.error(result.error.message || 'Failed to update user')
      return
    }
    toast.success(user.banned ? 'User unbanned' : 'User banned')
    router.refresh()
  }

  const sendPasswordSetup = async () => {
    setBusy(true)
    const passwordResult = await authClient.admin.setUserPassword({
      userId: user.id,
      newPassword: generateHiddenPassword(),
    })
    const resetResult = passwordResult.error
      ? passwordResult
      : await authClient.requestPasswordReset({
          email: user.email,
          redirectTo: '/reset-password',
        })
    setBusy(false)
    if (resetResult.error) {
      toast.error(resetResult.error.message || 'Failed to send password setup email')
      return
    }
    toast.success(`Setup email sent to ${user.email}`)
  }

  const deleteUser = async () => {
    if (isCurrentUser) return
    if (!window.confirm(`Delete ${user.name}?`)) return
    setBusy(true)
    const result = await authClient.admin.removeUser({ userId: user.id })
    setBusy(false)
    if (result.error) {
      toast.error(result.error.message || 'Failed to delete user')
      return
    }
    toast.success('User deleted')
    router.push('/admin/users')
  }

  const currentRole = (user.role ?? 'user') as 'user' | 'admin'

  return (
    <div className="divide-y divide-gray-100">
      {/* Role toggle */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
            {iconRole}
          </div>
          <span className="text-sm font-semibold text-gray-800">Role</span>
        </div>
        <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['user', 'admin'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => void updateRole(role)}
              disabled={busy}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
                currentRole === role
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Password setup */}
      <div className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
            {iconPassword}
          </div>
          <span className="text-sm font-semibold text-gray-800">Password setup</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void sendPasswordSetup()}
          disabled={busy}
        >
          Send email
        </Button>
      </div>

      {/* Ban / Unban */}
      <div className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${user.banned ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
            {iconBan}
          </div>
          <span className="text-sm font-semibold text-gray-800">
            {user.banned ? 'Banned' : 'Access'}
          </span>
        </div>
        <Button
          type="button"
          variant={user.banned ? 'secondary' : 'danger'}
          size="sm"
          onClick={() => void toggleBan()}
          disabled={busy || isCurrentUser}
        >
          {user.banned ? 'Unban' : 'Ban'}
        </Button>
      </div>

      {/* Delete */}
      <div className="flex items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
            {iconDelete}
          </div>
          <span className="text-sm font-semibold text-gray-400">Delete account</span>
        </div>
        <button
          type="button"
          onClick={() => void deleteUser()}
          disabled={busy || isCurrentUser}
          className="text-xs font-semibold text-gray-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

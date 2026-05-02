'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { USERNAME_PATTERN } from '@/lib/auth-utils'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { generateHiddenPassword } from '../../admin-types'

export function NewUserPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const createUser = async () => {
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedEmail = email.trim().toLowerCase()
    setSentTo(null)

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      toast.error('Username must be 3-30 chars and may contain letters, numbers, dots, and underscores.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error('Enter a valid email address.')
      return
    }

    if (showPassword && password) {
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match.')
        return
      }
    }

    const chosenPassword = showPassword && password ? password : generateHiddenPassword()

    setCreating(true)
    const createResult = await authClient.admin.createUser({
      email: normalizedEmail,
      password: chosenPassword,
      name: name.trim() || normalizedUsername,
      role,
      data: {
        username: normalizedUsername,
        displayUsername: username.trim(),
      },
    })

    if (createResult.error) {
      setCreating(false)
      toast.error(createResult.error.message || 'Failed to create user')
      return
    }

    // Only send setup email when no manual password was set
    if (!showPassword || !password) {
      const resetResult = await authClient.requestPasswordReset({
        email: normalizedEmail,
        redirectTo: '/reset-password',
      })
      setCreating(false)

      if (resetResult.error) {
        toast.error(resetResult.error.message || 'User created, but password setup email could not be sent.')
        return
      }

      setSentTo(normalizedEmail)
      toast.success('User created and setup email sent')
    } else {
      setCreating(false)
      toast.success('User created')
    }

    setName('')
    setUsername('')
    setEmail('')
    setRole('user')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="New user"
        back={
          <Link href="/admin/users">
            <Button type="button" variant="secondary" size="sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          </Link>
        }
      />

      <Card padding="lg">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            placeholder="username"
            hint="3-30 chars: letters, numbers, dots, and underscores."
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@company.com"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-user-role" className="text-sm font-medium text-gray-900">Role</label>
            <select
              id="new-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
              className="min-h-[46px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary md:text-sm"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>

        {/* Collapsible password section */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => {
              setShowPassword((v) => !v)
              setPassword('')
              setConfirmPassword('')
            }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Set password manually
            </span>
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${showPassword ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPassword && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
              />
              <p className="col-span-full text-xs font-medium text-gray-400">
                No setup email will be sent when a manual password is set.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end border-t border-gray-100 pt-5">
          <Button
            type="button"
            onClick={() => void createUser()}
            loading={creating}
            disabled={!username.trim() || !email.trim()}
          >
            Create user
          </Button>
        </div>
      </Card>

      {sentTo && (
        <Card className="border-[#80BC17]/30 bg-[#80BC17]/10">
          <div className="text-sm font-semibold text-gray-800">
            Password setup email sent to <span className="font-black text-gray-950">{sentTo}</span>.
          </div>
        </Card>
      )}
    </div>
  )
}

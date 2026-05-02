'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ResetPasswordFormProps = {
  token: string
  error: string
  username?: string
}

export function ResetPasswordForm({ token, error, username }: ResetPasswordFormProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState(error === 'INVALID_TOKEN' ? 'This password link is invalid or expired.' : '')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    if (!token) {
      setFormError('This password link is invalid or expired.')
      return
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setLoading(false)

    if (result.error) {
      setFormError(result.error.message || 'Password could not be updated.')
      return
    }

    router.push('/sign-in')
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#F4F6F3] px-4 py-8">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/leaderboard" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <Image src="/icon1.png" alt="FillerLog logo" width={88} height={88} className="h-14 w-14 object-cover" priority />
          </Link>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-950">Set password</h1>
        </div>

        {username && (
          <div className="mb-4 rounded-2xl border border-black/5 bg-white px-4 py-3 text-center shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Signing in as</div>
            <div className="mt-1 text-lg font-black text-gray-300">@{username}</div>
          </div>
        )}

        <form onSubmit={submit} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {formError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {formError}
              </div>
            )}
            <Button type="submit" size="lg" fullWidth loading={loading} disabled={!token}>
              Save password
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}

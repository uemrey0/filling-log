'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type SignInFormProps = {
  callbackURL: string
}

export function SignInForm({ callbackURL }: SignInFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const safeCallbackURL = useMemo(() => {
    if (!callbackURL.startsWith('/') || callbackURL.startsWith('//')) return '/dashboard'
    if (callbackURL === '/sign-in') return '/dashboard'
    return callbackURL
  }, [callbackURL])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    const result = await authClient.signIn.username({
      username: username.trim(),
      password,
    })

    setLoading(false)

    if (result.error) {
      setError('Username or password is invalid.')
      return
    }

    router.push(safeCallbackURL)
    router.refresh()
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#F4F6F3] px-4 py-8">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/leaderboard" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <Image src="/icon1.png" alt="FillerLog logo" width={88} height={88} className="h-14 w-14 object-cover" priority />
          </Link>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-950">FillerLog</h1>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <Input
              label="Username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Sign in
            </Button>
          </div>
        </form>

        <div className="mt-5 text-center">
          <Link href="/leaderboard" className="text-sm font-semibold text-gray-500 hover:text-gray-900">
            View leaderboard
          </Link>
        </div>
      </div>
    </main>
  )
}

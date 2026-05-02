'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/components/providers/LanguageProvider'

type SignInFormProps = {
  callbackURL: string
}

export function SignInForm({ callbackURL }: SignInFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
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
      setError(t('signIn.invalidCredentials'))
      return
    }

    router.push(safeCallbackURL)
    router.refresh()
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#F4F6F3] px-4 py-8">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 flex flex-col items-center">
          <Link href="/">
            <Image src="/logo.png" alt="FillerLog logo" width={256} height={256} priority />
          </Link>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <Input
              label={t('signIn.username')}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <Input
              label={t('signIn.password')}
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
              {t('signIn.submit')}
            </Button>
          </div>
        </form>

      </div>
    </main>
  )
}

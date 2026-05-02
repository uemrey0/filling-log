'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/components/providers/LanguageProvider'

type ResetPasswordFormProps = {
  token: string
  error: string
  username?: string
}

export function ResetPasswordForm({ token, error, username }: ResetPasswordFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState(
    error === 'INVALID_TOKEN' ? t('resetPassword.invalidToken') : '',
  )
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    if (!token) {
      setFormError(t('resetPassword.invalidToken'))
      return
    }

    if (password.length < 8) {
      setFormError(t('resetPassword.passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      setFormError(t('resetPassword.passwordMismatch'))
      return
    }

    setLoading(true)
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setLoading(false)

    if (result.error) {
      setFormError(result.error.message || t('resetPassword.updateFailed'))
      return
    }

    router.push('/sign-in')
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#F4F6F3] px-4 py-8">
      <div className="w-full max-w-[390px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-1">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <Image src="/logo.png" alt="FillerLog logo" width={56} height={56} className="h-14 w-14 object-cover" priority />
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-950">
            {t('resetPassword.title')}
          </h1>
        </div>

        {username && (
          <div className="mb-4 rounded-2xl border border-black/5 bg-white px-4 py-3 text-center shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {t('resetPassword.signingInAs')}
            </div>
            <div className="mt-1 text-lg font-black text-gray-300">@{username}</div>
          </div>
        )}

        <form onSubmit={submit} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <Input
              label={t('resetPassword.newPassword')}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Input
              label={t('resetPassword.confirmPassword')}
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
              {t('resetPassword.submit')}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/components/providers/LanguageProvider'

export function WelcomeScreen() {
  const { t } = useLanguage()

  return (
    <div
      className="fixed inset-0 flex flex-col px-6"
      style={{ background: 'var(--bg-page)' }}
    >
      {/* Blurred color blobs */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: 'var(--brand-primary)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ background: 'var(--brand-primary-dark)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: 'var(--brand-primary)' }}
      />

      <div className="relative flex flex-1 items-center justify-center">
        <Image src="/logo.png" alt="FillerLog" width={220} height={220} priority />
      </div>

      <div
        className="relative flex flex-col gap-3"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <Link
          href="/sign-in"
          className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white active:opacity-75"
          style={{ background: 'var(--brand-primary)' }}
        >
          {t('welcome.signIn')}
        </Link>
        <Link
          href="/leaderboard"
          className="flex h-14 w-full items-center justify-center rounded-2xl border border-gray-200 bg-white text-base font-medium text-gray-600 active:opacity-75"
        >
          {t('welcome.continueWithout')}
        </Link>
      </div>
    </div>
  )
}

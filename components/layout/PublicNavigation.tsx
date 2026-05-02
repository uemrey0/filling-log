'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/components/providers/LanguageProvider'

const leaderboardIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
)

const signInIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
  </svg>
)

export function PublicNavigation() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const isLeaderboard = pathname === '/leaderboard'

  return (
    <>
      <aside
        className={`hidden md:flex md:flex-col md:border-r md:border-black/5 md:bg-[#f1f0ec]/88 md:py-7 md:backdrop-blur-sm md:transition-[width,padding] md:duration-200 ${
          collapsed ? 'md:w-[92px] md:px-3' : 'md:w-[272px] md:px-5'
        }`}
      >
        <div className={`flex items-center px-2 py-1 ${collapsed ? 'justify-center' : 'justify-between gap-3'}`}>
          <Link
            href="/leaderboard"
            className={`flex min-w-0 items-center text-gray-900 ${collapsed ? 'justify-center' : 'gap-3'}`}
            aria-label="FillerLog"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
              <Image src="/icon1.png" alt="FillerLog logo" width={64} height={64} className="h-10 w-10 object-cover" priority />
            </div>
            {!collapsed && <span className="min-w-0 text-[18px] font-bold leading-none tracking-tight">FillerLog</span>}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-800"
              aria-label="Collapse sidebar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mt-5 flex h-10 w-10 self-center items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-800"
            aria-label="Expand sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <nav className={`flex flex-1 flex-col gap-2 ${collapsed ? 'mt-6' : 'mt-10'}`}>
          <Link
            href="/leaderboard"
            aria-label={t('nav.leaderboard')}
            title={collapsed ? t('nav.leaderboard') : undefined}
            className={`flex items-center rounded-[18px] py-3 text-[15px] font-semibold transition-colors ${
              collapsed ? 'justify-center px-3' : 'gap-3 px-4'
            } ${
              isLeaderboard
                ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/5'
                : 'text-gray-500 hover:bg-white/50 hover:text-gray-800'
            }`}
          >
            <span className={`flex h-6 w-6 items-center justify-center ${isLeaderboard ? 'text-[#80BC17]' : 'text-gray-500'}`}>
              {leaderboardIcon}
            </span>
            {!collapsed && <span>{t('nav.leaderboard')}</span>}
          </Link>
        </nav>

        <Link
          href="/sign-in"
          aria-label="Sign in"
          title={collapsed ? 'Sign in' : undefined}
          className={`flex min-h-10 items-center rounded-xl text-sm font-semibold text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-900 ${
            collapsed ? 'justify-center' : 'gap-3 px-3'
          }`}
        >
          {signInIcon}
          {!collapsed && <span>Sign in</span>}
        </Link>
      </aside>

      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-sm md:hidden">
        <div className="mobile-bottom-nav__row flex">
          <Link
            href="/leaderboard"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors"
            style={isLeaderboard ? { color: '#80BC17' } : { color: '#6b7280' }}
          >
            {leaderboardIcon}
            <span className="text-[10px] font-semibold leading-tight">{t('nav.leaderboard')}</span>
          </Link>
          <Link
            href="/sign-in"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-gray-500 transition-colors"
          >
            {signInIcon}
            <span className="text-[10px] font-semibold leading-tight">Sign in</span>
          </Link>
        </div>
      </nav>
    </>
  )
}

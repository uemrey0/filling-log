'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { authClient } from '@/lib/auth-client'

const icons = {
  dashboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  tasks: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  personnel: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  analytics: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  leaderboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  admin: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 4.1-2.9 7.9-7 9-4.1-1.1-7-4.9-7-9V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 12.5l1.7 1.7 3.6-4" />
    </svg>
  ),
  signOut: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
    </svg>
  ),
  more: (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
}

const navItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard' as const, icon: icons.dashboard },
  { href: '/tasks', labelKey: 'nav.tasks' as const, icon: icons.tasks },
  { href: '/personnel', labelKey: 'nav.personnel' as const, icon: icons.personnel },
  { href: '/analytics', labelKey: 'nav.analytics' as const, icon: icons.analytics },
  { href: '/leaderboard', labelKey: 'nav.leaderboard' as const, icon: icons.leaderboard },
  { href: '/settings', labelKey: 'nav.settings' as const, icon: icons.settings },
]

type NavigationProps = {
  userName: string
  userRole: string
}

export function Navigation({ userName, userRole }: NavigationProps) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const isAdmin = userRole === 'admin'
  const mobilePrimaryItems = navItems.slice(0, 4)
  const mobileSheetItems = navItems.slice(4)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const moreActive = mobileSheetItems.some((item) => isActive(item.href)) || isActive('/admin')

  const signOut = () => {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/sign-in'
        },
      },
    })
  }

  const renderNavLink = (item: (typeof navItems)[number]) => (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center rounded-[18px] py-3 text-[15px] font-semibold transition-colors ${
        collapsed ? 'justify-center px-3' : 'gap-3 px-4'
      } ${
        isActive(item.href)
          ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/5'
          : 'text-gray-500 hover:bg-white/50 hover:text-gray-800'
      }`}
      aria-label={t(item.labelKey)}
      title={collapsed ? t(item.labelKey) : undefined}
    >
      <span className={`flex h-6 w-6 items-center justify-center transition-colors ${isActive(item.href) ? 'text-[#80BC17]' : 'text-gray-500'}`}>
        {item.icon}
      </span>
      {!collapsed && <span>{t(item.labelKey)}</span>}
    </Link>
  )

  return (
    <>
      <aside
        className={`hidden md:flex md:flex-col md:border-r md:border-black/5 md:bg-[#f1f0ec]/88 md:py-7 md:backdrop-blur-sm md:transition-[width,padding] md:duration-200 ${
          collapsed ? 'md:w-[92px] md:px-3' : 'md:w-[272px] md:px-5'
        }`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-3'} px-2 py-1`}>
          <Link href="/dashboard" className={`flex min-w-0 items-center text-gray-900 ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md">
              <Image src="/icon1.png" alt="FillerLog logo" width={64} height={64} className="h-10 w-10 object-cover" priority />
            </div>
            {!collapsed && <span className="min-w-0 text-[18px] font-bold leading-none tracking-tight">FillerLog</span>}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-800"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
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
            title="Expand sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <nav className={`flex flex-1 flex-col gap-2 ${collapsed ? 'mt-6' : 'mt-10'}`}>
          {navItems.map(renderNavLink)}
        </nav>

        <div className={`mt-6 border-t border-black/5 pt-4 ${collapsed ? 'px-0' : 'px-2'}`}>
          {!collapsed && (
            <div className="mb-3 min-w-0">
              <div className="truncate text-sm font-bold text-gray-900">{userName}</div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{userRole}</div>
            </div>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              className={`mb-2 flex min-h-10 items-center rounded-xl text-sm font-semibold transition-colors ${
                collapsed ? 'w-10 justify-center' : 'w-full gap-3 px-3'
              } ${isActive('/admin') ? 'bg-white text-gray-900 ring-1 ring-black/5' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'}`}
              aria-label="Admin panel"
              title="Admin panel"
            >
              {icons.admin}
              {!collapsed && <span>Admin panel</span>}
            </Link>
          )}

          <button
            type="button"
            onClick={signOut}
            className={`flex min-h-10 items-center rounded-xl text-sm font-semibold text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-900 ${
              collapsed ? 'w-10 justify-center' : 'w-full gap-3 px-3'
            }`}
            aria-label="Sign out"
            title="Sign out"
          >
            {icons.signOut}
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-sm md:hidden">
        <div className="mobile-bottom-nav__row flex">
          {mobilePrimaryItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors"
              style={isActive(item.href) ? { color: '#80BC17' } : { color: '#6b7280' }}
            >
              {item.icon}
              <span className="text-[10px] font-semibold leading-tight">{t(item.labelKey)}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors"
            style={moreActive ? { color: '#80BC17' } : { color: '#6b7280' }}
            aria-label="More"
          >
            {icons.more}
            <span className="text-[10px] font-semibold leading-tight">More</span>
          </button>
        </div>
      </nav>

      <ModalOrSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#80BC17]/15 text-base font-black text-[#1C7745]">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-black text-gray-950">{userName}</div>
              <div className="mt-0.5 text-xs font-bold uppercase tracking-wide text-gray-400">{userRole}</div>
            </div>
          </div>

          <div className="space-y-2">
            {mobileSheetItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold ${
                  isActive(item.href) ? 'bg-[#F4F9EA] text-gray-950' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={isActive(item.href) ? 'text-[#80BC17]' : 'text-gray-400'}>{item.icon}</span>
                <span>{t(item.labelKey)}</span>
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMoreOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold ${
                  isActive('/admin') ? 'bg-[#F4F9EA] text-gray-950' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={isActive('/admin') ? 'text-[#80BC17]' : 'text-gray-400'}>{icons.admin}</span>
                <span>Admin panel</span>
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={signOut}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            {icons.signOut}
            <span>Sign out</span>
          </button>
        </div>
      </ModalOrSheet>
    </>
  )
}

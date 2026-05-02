'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

type AdminShellProps = {
  children: React.ReactNode
  userName: string
  userRole: string
}

const icons = {
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 14c2.21 0 4 1.57 4 3.5V19H4v-1.5C4 15.57 5.79 14 8 14h8zM12 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  ),
  home: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  signOut: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
    </svg>
  ),
  collapse: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
  expand: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
}

const navItems = [
  { href: '/admin/users', label: 'Users', icon: icons.users },
]

export function AdminShell({ children, userName, userRole }: AdminShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const signOut = () => {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/sign-in'
        },
      },
    })
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="text-gray-950">
      {/* Desktop sidebar — fixed, collapsible */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-black/5 bg-[#f1f0ec]/88 py-7 backdrop-blur-sm transition-[width,padding] duration-200 md:flex ${
          collapsed ? 'w-[92px] px-3' : 'w-[272px] px-5'
        }`}
      >
        <div className={`flex items-center px-2 py-1 ${collapsed ? 'justify-center' : 'justify-between gap-3'}`}>
          <Link
            href="/admin/users"
            className={`flex min-w-0 items-center text-gray-900 ${collapsed ? 'justify-center' : 'gap-3'}`}
            aria-label="FillerLog Admin"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
              <Image src="/icon1.png" alt="FillerLog logo" width={64} height={64} className="h-10 w-10 object-cover" priority />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[18px] font-bold leading-none tracking-tight">FillerLog</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Admin</div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-800"
              aria-label="Collapse sidebar"
            >
              {icons.collapse}
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
            {icons.expand}
          </button>
        )}

        <nav className={`flex flex-1 flex-col gap-2 ${collapsed ? 'mt-6' : 'mt-10'}`}>
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-[18px] py-3 text-[15px] font-semibold transition-colors ${
                  collapsed ? 'justify-center px-3' : 'gap-3 px-4'
                } ${
                  active
                    ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-black/5'
                    : 'text-gray-500 hover:bg-white/50 hover:text-gray-800'
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center ${active ? 'text-[#80BC17]' : 'text-gray-500'}`}>
                  {item.icon}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className={`mt-6 border-t border-black/5 pt-4 ${collapsed ? 'px-0' : 'px-2'}`}>
          {!collapsed && (
            <div className="mb-3 min-w-0">
              <div className="truncate text-sm font-bold text-gray-900">{userName}</div>
              <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{userRole}</div>
            </div>
          )}
          <Link
            href="/dashboard"
            aria-label="App"
            title={collapsed ? 'App' : undefined}
            className={`mb-2 flex min-h-10 items-center rounded-xl text-sm font-semibold text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-900 ${
              collapsed ? 'w-10 justify-center' : 'w-full gap-3 px-3'
            }`}
          >
            {icons.home}
            {!collapsed && <span>App</span>}
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title={collapsed ? 'Sign out' : undefined}
            className={`flex min-h-10 items-center rounded-xl text-sm font-semibold text-gray-500 transition-colors hover:bg-white/60 hover:text-gray-900 ${
              collapsed ? 'w-10 justify-center' : 'w-full gap-3 px-3'
            }`}
          >
            {icons.signOut}
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main content — offset by sidebar width, transitions with it */}
      <div
        className={`mobile-bottom-nav-spacer transition-[padding] duration-200 ${
          collapsed ? 'md:pl-[92px]' : 'md:pl-[272px]'
        }`}
      >
        <div className="px-4 py-5 md:px-8 md:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur-sm md:hidden">
        <div className="mobile-bottom-nav__row flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors"
              style={isActive(item.href) ? { color: '#80BC17' } : { color: '#6b7280' }}
            >
              {item.icon}
              <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2"
            style={{ color: '#6b7280' }}
          >
            {icons.home}
            <span className="text-[10px] font-semibold leading-tight">App</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}

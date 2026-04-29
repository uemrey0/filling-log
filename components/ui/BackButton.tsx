'use client'

import type { ButtonHTMLAttributes } from 'react'
import { useRouter } from 'next/navigation'
import { navigateBack } from '@/lib/navigation'

interface BackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fallbackHref: string
}

export function BackButton({
  fallbackHref,
  type = 'button',
  onClick,
  children,
  ...props
}: BackButtonProps) {
  const router = useRouter()

  return (
    <button
      type={type}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        navigateBack(router, fallbackHref)
      }}
      {...props}
    >
      {children ?? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      )}
    </button>
  )
}

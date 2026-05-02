import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: ReactNode
  action?: ReactNode
}

export function PageHeader({ title, subtitle, back, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 md:mb-8">
      <div className="flex min-w-0 items-center gap-3">
        {back && <div className="flex-shrink-0">{back}</div>}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-black md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

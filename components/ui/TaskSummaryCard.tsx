import { Card } from './Card'
import { PerformanceDiff } from './PerformanceDiff'
import { Skeleton } from './Skeleton'

type StatusTone = 'active' | 'paused'

interface TaskSummaryCardProps {
  accentColor: string
  title: string
  subtitle: string
  timeRange: string
  statusLabel?: string
  statusTone?: StatusTone
  duration?: string | null
  diffMinutes?: number | null
  hasNotes?: boolean
  className?: string
}

export function TaskSummaryCard({
  accentColor,
  title,
  subtitle,
  timeRange,
  statusLabel,
  statusTone = 'active',
  duration,
  diffMinutes,
  hasNotes = false,
  className = '',
}: TaskSummaryCardProps) {
  return (
    <Card padding="none" className={`overflow-hidden ${className}`}>
      <div className="flex">
        <div className="w-1.5 flex-shrink-0 self-stretch" style={{ backgroundColor: accentColor }} />
        <div className="flex-1 flex items-center justify-between gap-3 px-3 py-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-sm leading-snug truncate">{title}</span>
              {hasNotes && (
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700"
                  aria-label="notes"
                  title="Notes"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                </span>
              )}
              {statusLabel && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      statusTone === 'paused' ? 'bg-orange-400' : 'bg-[#80BC17] animate-pulse'
                    }`}
                  />
                  {statusLabel}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</div>
            <div className="text-xs text-gray-400 tabular-nums mt-1">{timeRange}</div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {duration && (
              <span className="text-sm font-bold text-gray-800 tabular-nums">{duration}</span>
            )}
            {diffMinutes !== null && diffMinutes !== undefined && (
              <PerformanceDiff diffMinutes={diffMinutes} />
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function TaskSummaryCardSkeleton() {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex">
        <div className="w-1.5 flex-shrink-0 self-stretch bg-gray-200" />
        <div className="flex-1 flex items-center justify-between gap-3 px-3 py-3 min-w-0">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex-shrink-0 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  )
}

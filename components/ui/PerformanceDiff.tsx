import { formatMinutes } from '@/lib/business'

interface PerformanceDiffProps {
  diffMinutes: number
  showSign?: boolean
  variant?: 'badge' | 'metric'
}

export function PerformanceDiff({
  diffMinutes,
  showSign = true,
  variant = 'badge',
}: PerformanceDiffProps) {
  const rounded = Math.round(diffMinutes * 10) / 10
  const isAhead = rounded < -0.5
  const isOnTime = Math.abs(rounded) <= 0.5
  const sign = showSign ? (isAhead ? '-' : '+') : ''

  if (variant === 'metric') {
    if (isOnTime) {
      return <span className="text-2xl font-bold tabular-nums text-gray-400">+/- 0m</span>
    }

    return (
      <span className={`text-2xl font-bold tabular-nums ${isAhead ? 'text-[#1C7745]' : 'text-[#E40B17]'}`}>
        {sign}
        {formatMinutes(isAhead ? Math.abs(rounded) : rounded)}
      </span>
    )
  }

  if (isOnTime) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
        +/- 0m
      </span>
    )
  }

  if (isAhead) {
    // Faster than expected → green (good)
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#80BC17]/15 text-[#1C7745]">
        {showSign ? '-' : ''}
        {formatMinutes(Math.abs(rounded))}
      </span>
    )
  }

  // Slower than expected → red (bad)
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#E40B17]/10 text-[#E40B17]">
      {showSign ? '+' : ''}
      {formatMinutes(rounded)}
    </span>
  )
}

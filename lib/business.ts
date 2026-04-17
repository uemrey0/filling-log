const TASK_FIXED_EXTRA_MINUTES = 5

export function calcExpectedMinutes(colliCount: number, personnelCount: number = 1): number {
  return Math.ceil(colliCount / Math.max(1, personnelCount)) + TASK_FIXED_EXTRA_MINUTES
}

export function calcActualMinutes(startedAt: Date, endedAt: Date): number {
  return (endedAt.getTime() - startedAt.getTime()) / 60000
}

export function calcPerformanceDiff(actualMinutes: number, expectedMinutes: number): number {
  return actualMinutes - expectedMinutes
}

export function formatMinutes(minutes: number): string {
  const absMin = Math.abs(minutes)
  const h = Math.floor(absMin / 60)
  const m = Math.round(absMin % 60)
  if (h === 0) return `${m}m`
  return `${h}u ${m}m`
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return `${h}u ${m}m`
}

export function formatDurationWithSeconds(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * 60))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function todayDate(): string {
  const now = new Date()
  const localMidnightSafe = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localMidnightSafe.toISOString().slice(0, 10)
}

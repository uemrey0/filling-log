const TASK_FIXED_EXTRA_MINUTES = 5

export function calcExpectedMinutes(colliCount: number, personnelCount: number = 1): number {
  return Math.ceil(colliCount / Math.max(1, personnelCount)) + TASK_FIXED_EXTRA_MINUTES
}

export function calcExpectedMinutesFromSessionStarts(
  colliCount: number,
  startedAts: Array<Date | string>,
): number {
  const validStarts = startedAts
    .map((value) => (typeof value === 'string' ? new Date(value).getTime() : value.getTime()))
    .filter((ts) => Number.isFinite(ts))
    .sort((a, b) => a - b)

  if (colliCount <= 0) return TASK_FIXED_EXTRA_MINUTES
  if (validStarts.length === 0) return calcExpectedMinutes(colliCount, 1)

  const anchor = validStarts[0]!
  const eventCounts = new Map<number, number>()
  for (const ts of validStarts) {
    eventCounts.set(ts, (eventCounts.get(ts) ?? 0) + 1)
  }

  const eventTimes = Array.from(eventCounts.keys()).sort((a, b) => a - b)
  let remaining = colliCount
  let active = 0
  let elapsedMinutes = 0
  let prevTs = anchor

  for (const eventTs of eventTimes) {
    const deltaMin = Math.max(0, (eventTs - prevTs) / 60000)
    if (active > 0 && deltaMin > 0) {
      const capacity = active * deltaMin
      if (capacity >= remaining) {
        elapsedMinutes += remaining / active
        return Math.ceil(TASK_FIXED_EXTRA_MINUTES + elapsedMinutes)
      }
      remaining -= capacity
      elapsedMinutes += deltaMin
    }

    active += eventCounts.get(eventTs) ?? 0
    prevTs = eventTs
  }

  const normalizedActive = Math.max(1, active)
  elapsedMinutes += remaining / normalizedActive
  return Math.ceil(TASK_FIXED_EXTRA_MINUTES + elapsedMinutes)
}

function toMillis(value: Date | string): number | null {
  const ts = typeof value === 'string' ? new Date(value).getTime() : value.getTime()
  return Number.isFinite(ts) ? ts : null
}

export function roundToOne(value: number): number {
  return Math.round(value * 10) / 10
}

export function calcTaskProjectedExpectedMinutes(
  colliCount: number,
  startedAts: Array<Date | string>,
): { projectedExpectedMinutes: number; taskStartedAtMs: number } | null {
  const validStarts = startedAts.map(toMillis).filter((ts): ts is number => ts !== null)
  if (validStarts.length === 0) return null

  return {
    projectedExpectedMinutes: calcExpectedMinutesFromSessionStarts(colliCount, startedAts),
    taskStartedAtMs: Math.min(...validStarts),
  }
}

export function calcExpectedMinutesForSession(
  projectedExpectedMinutes: number,
  taskStartedAt: Date | string | number,
  sessionStartedAt: Date | string,
): number {
  const taskStartedAtMs = typeof taskStartedAt === 'number' ? taskStartedAt : toMillis(taskStartedAt)
  const sessionStartedAtMs = toMillis(sessionStartedAt)
  if (taskStartedAtMs === null || sessionStartedAtMs === null) return projectedExpectedMinutes

  const offsetMinutes = Math.max(0, (sessionStartedAtMs - taskStartedAtMs) / 60000)
  return roundToOne(Math.max(0, projectedExpectedMinutes - offsetMinutes))
}

export function calcActualMinutesNet(
  startedAt: Date | string,
  endedAt: Date | string | null,
  totalPausedMinutes: number = 0,
): number | null {
  if (!endedAt) return null

  const startedAtMs = toMillis(startedAt)
  const endedAtMs = toMillis(endedAt)
  if (startedAtMs === null || endedAtMs === null) return null

  const netMinutes = Math.max(
    0,
    (endedAtMs - startedAtMs) / 60000 - Math.max(0, totalPausedMinutes || 0),
  )
  return roundToOne(netMinutes)
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

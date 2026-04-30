export type TimePreset = '7d' | '14d' | '30d' | '90d' | 'all' | 'custom'

export interface AppliedTimeFilter {
  preset: TimePreset
  dateFrom: string
  dateTo: string
}

export function toLocalDateIso(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 10)
}

export function shiftDate(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toLocalDateIso(date)
}

export function getTimePresetRange(
  preset: TimePreset,
  customFrom: string,
  customTo: string,
): { dateFrom: string; dateTo: string } | null {
  if (preset === 'all') return null
  if (preset === 'custom') {
    return customFrom && customTo ? { dateFrom: customFrom, dateTo: customTo } : null
  }

  const days = preset === '7d' ? 7 : preset === '14d' ? 14 : preset === '30d' ? 30 : 90
  const dateTo = toLocalDateIso(new Date())
  const dateFrom = shiftDate(dateTo, -(days - 1))
  return { dateFrom, dateTo }
}

export function getAppliedTimeFilter(
  preset: TimePreset,
  customFrom: string,
  customTo: string,
): AppliedTimeFilter {
  const range = getTimePresetRange(preset, customFrom, customTo)
  return {
    preset,
    dateFrom: range?.dateFrom ?? '',
    dateTo: range?.dateTo ?? '',
  }
}

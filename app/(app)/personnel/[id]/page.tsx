'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { TaskSummaryCard } from '@/components/ui/TaskSummaryCard'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDate, formatDuration, formatDurationWithSeconds } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import type { Personnel } from '@/lib/db/schema'

interface SessionDetail {
  id: string
  startedAt: string
  endedAt: string | null
  workDate: string
  taskId: string
  department: string
  colliCount: number
  expectedMinutes: number
  actualMinutes: number | null
  performanceDiff: number | null
}

interface PeriodStats {
  totalSessions: number
  avgDiff: number | null
  avgActualPerColli: number | null
}

interface PersonnelData extends Personnel {
  sessions: SessionDetail[]
  total: number
  page: number
  limit: number
  stats: PeriodStats
  prevStats: PeriodStats | null
}

type Preset = '7d' | '14d' | '30d' | '90d' | 'all' | 'custom'

function toLocalDateIso(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 10)
}

function shiftDate(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return toLocalDateIso(d)
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function getPresetRange(preset: Preset, customFrom: string, customTo: string): { dateFrom: string; dateTo: string } | null {
  if (preset === 'all') return null
  if (preset === 'custom') {
    return customFrom && customTo ? { dateFrom: customFrom, dateTo: customTo } : null
  }
  const days = preset === '7d' ? 7 : preset === '14d' ? 14 : preset === '30d' ? 30 : 90
  const to = toLocalDateIso(new Date())
  const from = shiftDate(to, -(days - 1))
  return { dateFrom: from, dateTo: to }
}

function ComparisonBadge({
  current,
  prev,
  higherIsBetter = false,
}: {
  current: number | null
  prev: number | null
  higherIsBetter?: boolean
}) {
  if (current === null || prev === null || prev === 0) return null
  const pct = Math.round(((current - prev) / Math.abs(prev)) * 100)
  const better = higherIsBetter ? current > prev : current < prev
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: better ? '#80BC1720' : '#E40B1720',
        color: better ? '#1C7745' : '#E40B17',
      }}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={better ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
      </svg>
      {Math.abs(pct)}%
    </span>
  )
}

export default function PersonnelDetailPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()
  const initialRange = getPresetRange('7d', '', '')

  const [data, setData] = useState<PersonnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [preset, setPreset] = useState<Preset>('7d')
  const [customFrom, setCustomFrom] = useState(initialRange?.dateFrom ?? '')
  const [customTo, setCustomTo] = useState(initialRange?.dateTo ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [appliedPreset, setAppliedPreset] = useState<Preset>('7d')
  const [appliedFrom, setAppliedFrom] = useState(initialRange?.dateFrom ?? '')
  const [appliedTo, setAppliedTo] = useState(initialRange?.dateTo ?? '')
  const actionsRef = useRef<HTMLDivElement>(null)

  const PAGE_SIZE = 20

  const buildUrl = useCallback((p: number, ap: Preset, af: string, at: string) => {
    const range = getPresetRange(ap, af, at)
    const params2 = new URLSearchParams()
    params2.set('page', String(p))
    params2.set('limit', String(PAGE_SIZE))
    if (range) {
      params2.set('dateFrom', range.dateFrom)
      params2.set('dateTo', range.dateTo)
    }
    return `/api/personnel/${params.id}?${params2}`
  }, [params.id])

  const load = useCallback(async (ap: Preset, af: string, at: string) => {
    setLoading(true)
    try {
      const res = await apiFetch(buildUrl(1, ap, af, at))
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    load(appliedPreset, appliedFrom, appliedTo)
  }, [load, appliedPreset, appliedFrom, appliedTo])

  useEffect(() => {
    if (!showActions) return
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showActions])

  const customRangeValid = customFrom !== '' && customTo !== '' && customFrom <= customTo
  const canApply = preset !== 'custom' || customRangeValid

  const applyFilters = () => {
    if (!canApply) return
    setAppliedPreset(preset)
    setAppliedFrom(customFrom)
    setAppliedTo(customTo)
    setShowFilters(false)
  }

  const toggleActive = async () => {
    if (!data) return
    if (data.isActive) {
      const confirmed = window.confirm(t('personnel.confirmDeactivate'))
      if (!confirmed) return
    }

    setActionLoading(true)
    try {
      if (data.isActive) {
        await apiFetch(`/api/personnel/${data.id}`, { method: 'DELETE' })
      } else {
        await apiFetch(`/api/personnel/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: data.fullName, isActive: true, notes: data.notes }),
        })
      }
      await load(appliedPreset, appliedFrom, appliedTo)
      setShowActions(false)
    } finally {
      setActionLoading(false)
    }
  }

  const loadMore = async () => {
    if (!data) return
    const nextPage = data.page + 1
    setLoadingMore(true)
    try {
      const res = await apiFetch(buildUrl(nextPage, appliedPreset, appliedFrom, appliedTo))
      if (res.ok) {
        const next: PersonnelData = await res.json()
        setData((prev) => prev ? { ...next, sessions: [...prev.sessions, ...next.sessions] } : next)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/personnel"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>

        <Card padding="sm">
          <Skeleton className="h-4 w-full" />
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-44 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={`personnel-stats-skeleton-${idx}`} padding="sm" className="text-center space-y-2">
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
              <Skeleton className="h-5 w-14 mx-auto rounded-full" />
            </Card>
          ))}
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`personnel-history-skeleton-${idx}`} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-6 w-1 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-center py-20 text-gray-500">{t('common.noResults')}</div>
  }

  const { stats, prevStats } = data

  const completed = data.sessions.filter((s) => s.endedAt && s.performanceDiff !== null)
  const active = data.sessions.filter((s) => !s.endedAt)

  // Department breakdown from loaded sessions (all visible sessions)
  const deptMap = new Map<string, { count: number; totalDiff: number }>()
  for (const s of completed) {
    const existing = deptMap.get(s.department)
    if (!existing) {
      deptMap.set(s.department, { count: 1, totalDiff: Number(s.performanceDiff!) })
    } else {
      existing.count++
      existing.totalDiff += Number(s.performanceDiff!)
    }
  }
  const deptStats = Array.from(deptMap.entries())
    .map(([dept, { count, totalDiff }]) => ({ dept, count, avgDiff: totalDiff / count }))
    .sort((a, b) => b.count - a.count)

  const PRESETS: { key: Preset; label: string }[] = [
    { key: '7d', label: t('personnel.last7d') },
    { key: '14d', label: t('personnel.last14d') },
    { key: '30d', label: t('personnel.last30d') },
    { key: '90d', label: t('personnel.last90d') },
    { key: 'all', label: t('personnel.allTime') },
    { key: 'custom', label: t('personnel.customRange') },
  ]
  const quickPresets = PRESETS.filter((p) => p.key !== 'custom')

  const activeRange = getPresetRange(appliedPreset, appliedFrom, appliedTo)
  const rangeLabel = appliedPreset === 'all'
    ? t('personnel.allTime')
    : appliedPreset === 'custom' && activeRange
      ? `${activeRange.dateFrom} – ${activeRange.dateTo}`
      : PRESETS.find((p) => p.key === appliedPreset)?.label ?? ''

  const hasMore = data.sessions.length < data.total

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/personnel"
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{ backgroundColor: '#80BC17' + '25', color: '#1C7745' }}
            >
              {initials(data.fullName)}
            </span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{data.fullName}</h1>
              <Badge variant={data.isActive ? 'green' : 'gray'} className="mt-0.5">
                {data.isActive ? t('personnel.active') : t('personnel.inactive')}
              </Badge>
            </div>
          </div>
        </div>
        <div ref={actionsRef} className="relative">
          <button
            type="button"
            onClick={() => setShowActions((v) => !v)}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex items-center justify-center"
            aria-label={t('common.edit')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
            </svg>
          </button>
          {showActions && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
              <Link
                href={`/personnel/${data.id}/edit`}
                onClick={() => setShowActions(false)}
                className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('common.edit')}
              </Link>
              <button
                type="button"
                onClick={toggleActive}
                disabled={actionLoading}
                className="w-full text-left px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
                style={{ color: data.isActive ? '#E40B17' : '#1C7745' }}
              >
                {data.isActive ? t('personnel.deactivate') : t('personnel.activate')}
              </button>
            </div>
          )}
        </div>
      </div>

      {data.notes && (
        <Card padding="sm">
          <p className="text-sm text-gray-600">{data.notes}</p>
        </Card>
      )}

      {/* Currently active */}
      {active.length > 0 && (
        <Card padding="sm" style={{ borderColor: '#80BC17' + '50', backgroundColor: '#80BC17' + '05' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#80BC17' }} />
            <span className="text-sm font-medium" style={{ color: '#1C7745' }}>
              {lang === 'nl' ? 'Momenteel actief' : 'Currently active'}
            </span>
          </div>
          {active.map((s) => (
            <div key={s.id} className="mt-1.5 text-xs text-gray-600">
              {getDepartmentLabel(s.department, lang)} · {s.colliCount} colli · {t('tasks.started')}: {formatTime(s.startedAt)}
            </div>
          ))}
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {/* Preset pills – hidden on small screens, visible on sm+ */}
          <div className="hidden sm:flex gap-2">
            {quickPresets.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setAppliedPreset(p.key)
                  setPreset(p.key)
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
                style={
                  appliedPreset === p.key
                    ? { backgroundColor: '#80BC17', color: '#fff' }
                    : { backgroundColor: '#F3F4F6', color: '#374151' }
                }
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                setPreset('custom')
                setShowFilters(true)
              }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
              style={
                appliedPreset === 'custom'
                  ? { backgroundColor: '#80BC17', color: '#fff' }
                  : { backgroundColor: '#F3F4F6', color: '#374151' }
              }
            >
              {t('personnel.customRange')}
            </button>
          </div>
          {/* Mobile: show current range label */}
          <span className="sm:hidden text-sm font-medium text-gray-700">{rangeLabel}</span>
        </div>
        {/* Filter button – mobile opens bottom sheet, desktop opens sheet too for custom */}
        <button
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          {t('personnel.filters')}
        </button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalSessions}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t('personnel.totalTasks')}</div>
          {prevStats && (
            <div className="mt-1 flex justify-center">
              <ComparisonBadge current={stats.totalSessions} prev={prevStats.totalSessions} higherIsBetter />
            </div>
          )}
        </Card>

        <Card padding="sm" className="text-center">
          {stats.avgDiff !== null ? (
            <>
              <div className="flex justify-center mb-0.5">
                <PerformanceDiff diffMinutes={Number(stats.avgDiff)} />
              </div>
              <div className="text-xs text-gray-500">{t('analytics.avgDifference')}</div>
              {prevStats?.avgDiff !== null && prevStats !== null && (
                <div className="mt-1 flex justify-center">
                  <ComparisonBadge current={Number(stats.avgDiff)} prev={Number(prevStats.avgDiff)} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-300">–</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgDifference')}</div>
            </>
          )}
        </Card>

        {stats.avgActualPerColli !== null && (
          <Card padding="sm" className="text-center col-span-2">
            <div className="text-xl font-bold text-gray-900">
              {formatDurationWithSeconds(Number(stats.avgActualPerColli))}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{t('personnel.avgPerColli')}</div>
            {prevStats?.avgActualPerColli !== null && prevStats !== null && (
              <div className="mt-1 flex justify-center">
                <ComparisonBadge
                  current={Number(stats.avgActualPerColli)}
                  prev={Number(prevStats.avgActualPerColli)}
                />
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Department breakdown */}
      {deptStats.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            {t('analytics.byDepartment')}
          </h2>
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {deptStats.map(({ dept, count, avgDiff: diff }) => (
                <div key={dept} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{getDepartmentLabel(dept, lang)}</div>
                    <div className="text-xs text-gray-500">{count} {t('analytics.sessionCount')}</div>
                  </div>
                  <PerformanceDiff diffMinutes={diff} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Session history */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          {t('personnel.performanceHistory')}
        </h2>
        {completed.length === 0 ? (
          <Card>
            <EmptyState title={stats.totalSessions === 0 ? t('personnel.noDataForPeriod') : t('personnel.noHistory')} />
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {completed.map((s) => {
                const perfColor =
                  s.performanceDiff === null ? '#D1D5DB'
                  : Number(s.performanceDiff) <= 0 ? '#80BC17'
                  : '#E40B17'

                return (
                  <Link key={s.id} href={`/tasks/${s.taskId}`} className="block">
                    <TaskSummaryCard
                      className="hover:border-gray-300 transition-colors"
                      accentColor={perfColor}
                      title={getDepartmentLabel(s.department, lang)}
                      subtitle={`${formatDate(s.workDate)} · ${s.colliCount} ${t('tasks.colli')}`}
                      startTime={formatTime(s.startedAt)}
                      endTime={s.endedAt ? formatTime(s.endedAt) : null}
                      plannedEndTime={s.endedAt
                        ? formatTime(new Date(new Date(s.startedAt).getTime() + s.expectedMinutes * 60000))
                        : undefined}
                      plannedLabel={t('tasks.planned')}
                      duration={s.actualMinutes !== null ? formatDuration(Number(s.actualMinutes)) : null}
                      diffMinutes={s.performanceDiff !== null ? Number(s.performanceDiff) : null}
                    />
                  </Link>
                )
              })}
            </div>

            {hasMore && (
              <div className="mt-3 flex justify-center">
                <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadMore}>
                  {t('common.loadMore')} ({data.total - data.sessions.length})
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Sheet */}
      <ModalOrSheet open={showFilters} onClose={() => setShowFilters(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{t('personnel.filters')}</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPreset(p.key)
                  if (p.key !== 'custom') {
                    setAppliedPreset(p.key)
                    setShowFilters(false)
                  }
                }}
                className="py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={
                  preset === p.key
                    ? { backgroundColor: '#80BC17', color: '#fff' }
                    : { backgroundColor: '#F3F4F6', color: '#374151' }
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateFrom')}</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateTo')}</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={applyFilters} className="flex-1" disabled={!canApply}>
                  {t('analytics.apply')}
                </Button>
                <Button variant="secondary" onClick={() => setShowFilters(false)} className="flex-1">
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ModalOrSheet>
    </div>
  )
}

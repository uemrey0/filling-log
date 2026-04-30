'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { TaskSummaryCard } from '@/components/ui/TaskSummaryCard'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { TimeRangeFilter } from '@/components/ui/TimeRangeFilter'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDate, formatDuration, formatDurationWithSeconds } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import { getAppliedTimeFilter, getTimePresetRange, type TimePreset } from '@/lib/timeRange'
import { toast } from 'sonner'
import type { Personnel } from '@/lib/db/schema'

interface SessionDetail {
  id: string
  startedAt: string
  endedAt: string | null
  workDate: string
  taskId: string
  department: string
  discountContainer: boolean
  colliCount: number
  expectedMinutes: number
  expectedSessionMinutes?: number
  actualMinutes: number | null
  performanceDiff: number | null
}

interface PeriodStats {
  totalSessions: number
  avgDiff: number | null
  avgActualPerColli: number | null
}

interface DepartmentStat {
  department: string
  sessionCount: number
  avgDiff: number | null
}

interface PersonnelData extends Personnel {
  sessions: SessionDetail[]
  total: number
  page: number
  limit: number
  stats: PeriodStats
  prevStats: PeriodStats | null
  departmentStats: DepartmentStat[]
}

interface Comment {
  id: string
  content: string
  createdAt: string
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
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

function StarDisplay({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const rounded = Math.round(value * 2) / 2
  const cls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rounded
        return (
          <svg key={n} className={cls} fill={filled ? '#80BC17' : 'none'} stroke={filled ? '#80BC17' : '#D1D5DB'} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        )
      })}
    </div>
  )
}

function formatRelativeTime(dateStr: string, lang: 'nl' | 'en'): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return lang === 'nl' ? 'Vandaag' : 'Today'
  if (days === 1) return lang === 'nl' ? 'Gisteren' : 'Yesterday'
  if (days < 7) return lang === 'nl' ? `${days} dagen geleden` : `${days} days ago`
  return formatDate(dateStr)
}

export default function PersonnelDetailPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()
  const defaultFilter = getAppliedTimeFilter('7d', '', '')

  const [data, setData] = useState<PersonnelData | null>(null)
  const [loading, setLoading] = useState(true)

  const [preset, setPreset] = useState<TimePreset>(defaultFilter.preset)
  const [customFrom, setCustomFrom] = useState(defaultFilter.dateFrom)
  const [customTo, setCustomTo] = useState(defaultFilter.dateTo)
  const [showActions, setShowActions] = useState(false)
  const [showDiscountInfo, setShowDiscountInfo] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [appliedPreset, setAppliedPreset] = useState<TimePreset>(defaultFilter.preset)
  const [appliedFrom, setAppliedFrom] = useState(defaultFilter.dateFrom)
  const [appliedTo, setAppliedTo] = useState(defaultFilter.dateTo)
  const actionsRef = useRef<HTMLDivElement>(null)

  // Comments
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsTotal, setCommentsTotal] = useState(0)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [showAddComment, setShowAddComment] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  // UI toggles
  const [showRatingDetails, setShowRatingDetails] = useState(false)
  const [showDepts, setShowDepts] = useState(false)

  const PAGE_SIZE = 20

  const buildUrl = useCallback((p: number, ap: TimePreset, af: string, at: string) => {
    const range = getTimePresetRange(ap, af, at)
    const qs = new URLSearchParams()
    qs.set('page', String(p))
    qs.set('limit', String(PAGE_SIZE))
    if (range) {
      qs.set('dateFrom', range.dateFrom)
      qs.set('dateTo', range.dateTo)
    }
    return `/api/personnel/${params.id}?${qs}`
  }, [params.id])

  const load = useCallback(async (ap: TimePreset, af: string, at: string) => {
    setLoading(true)
    try {
      const res = await apiFetch(buildUrl(1, ap, af, at))
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  const loadComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const res = await apiFetch(`/api/personnel/${params.id}/comments?limit=3&page=1`)
      if (res.ok) {
        const json = await res.json()
        setComments(json.comments ?? [])
        setCommentsTotal(json.total ?? 0)
      }
    } finally {
      setCommentsLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    load(appliedPreset, appliedFrom, appliedTo)
  }, [load, appliedPreset, appliedFrom, appliedTo])

  useEffect(() => {
    void loadComments()
  }, [loadComments])

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
    const next = getAppliedTimeFilter(preset, customFrom, customTo)
    setAppliedPreset(next.preset)
    setAppliedFrom(next.dateFrom)
    setAppliedTo(next.dateTo)
  }

  const resetFilters = () => {
    setPreset(defaultFilter.preset)
    setCustomFrom(defaultFilter.dateFrom)
    setCustomTo(defaultFilter.dateTo)
    setAppliedPreset(defaultFilter.preset)
    setAppliedFrom(defaultFilter.dateFrom)
    setAppliedTo(defaultFilter.dateTo)
  }

  const selectQuickPreset = (nextPreset: TimePreset) => {
    setPreset(nextPreset)
    const next = getAppliedTimeFilter(nextPreset, customFrom, customTo)
    setAppliedPreset(next.preset)
    setAppliedFrom(next.dateFrom)
    setAppliedTo(next.dateTo)
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

  const saveComment = async () => {
    const content = newComment.trim()
    if (!content) return
    setSavingComment(true)
    try {
      const res = await apiFetch(`/api/personnel/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setNewComment('')
        setShowAddComment(false)
        await loadComments()
      } else {
        toast.error(lang === 'nl' ? 'Opmerking opslaan mislukt.' : 'Failed to save comment.')
      }
    } finally {
      setSavingComment(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    const confirmed = window.confirm(t('personnel.confirmDeleteComment'))
    if (!confirmed) return
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      await loadComments()
    } catch { /* no-op */ }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/personnel" className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0" aria-label={t('common.back')}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </BackButton>
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
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={`sk-${idx}`} padding="sm" className="text-center space-y-2">
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-center py-20 text-gray-500">{t('common.noResults')}</div>
  }

  const { stats, prevStats } = data

  // Rating data comes from cached personnel columns
  const hasRating = (data.ratingCount ?? 0) > 0
  const avgOverall = data.avgOverall ?? null

  const completed = data.sessions.filter((s) => s.endedAt && s.performanceDiff !== null)
  const active = data.sessions.filter((s) => !s.endedAt)

  const deptStats = data.departmentStats ?? []

  const PRESETS: { key: TimePreset; label: string }[] = [
    { key: '7d', label: t('personnel.last7d') },
    { key: '14d', label: t('personnel.last14d') },
    { key: '30d', label: t('personnel.last30d') },
    { key: '90d', label: t('personnel.last90d') },
    { key: 'all', label: t('personnel.allTime') },
    { key: 'custom', label: t('personnel.customRange') },
  ]
  const activeRange = getTimePresetRange(appliedPreset, appliedFrom, appliedTo)
  const rangeLabel = appliedPreset === 'all'
    ? t('personnel.allTime')
    : appliedPreset === 'custom' && activeRange
      ? `${activeRange.dateFrom} – ${activeRange.dateTo}`
      : PRESETS.find((p) => p.key === appliedPreset)?.label ?? ''

  const recentCompleted = completed.slice(0, 3)
  const hasMoreTasks = data.total > 3

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/personnel" className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0" aria-label={t('common.back')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </BackButton>
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0" style={{ backgroundColor: '#80BC1725', color: '#1C7745' }}>
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
          <button type="button" onClick={() => setShowActions((v) => !v)} className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex items-center justify-center" aria-label={t('common.edit')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" /></svg>
          </button>
          {showActions && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
              <Link href={`/personnel/${data.id}/edit`} onClick={() => setShowActions(false)} className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                {t('common.edit')}
              </Link>
              <button type="button" onClick={toggleActive} disabled={actionLoading} className="w-full text-left px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60" style={{ color: data.isActive ? '#E40B17' : '#1C7745' }}>
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

      {/* Currently active indicator */}
      {active.length > 0 && (
        <Card padding="sm" style={{ borderColor: '#80BC1750', backgroundColor: '#80BC1705' }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#80BC17' }} />
            <span className="text-sm font-medium" style={{ color: '#1C7745' }}>
              {lang === 'nl' ? 'Momenteel actief' : 'Currently active'}
            </span>
          </div>
          {active.map((s) => (
            <div key={s.id} className="mt-1.5 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <span>{getDepartmentLabel(s.department, lang)}</span>
                {s.discountContainer && (
                  <button type="button" onClick={() => setShowDiscountInfo(true)} className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-50 text-[10px] font-black text-red-600 ring-1 ring-red-200">%</button>
                )}
                <span>· {s.colliCount} colli · {t('tasks.started')}: {formatTime(s.startedAt)}</span>
              </span>
            </div>
          ))}
        </Card>
      )}

      <TimeRangeFilter
        title={t('personnel.filters')}
        filterLabel={t('personnel.filters')}
        applyLabel={t('analytics.apply')}
        secondaryLabel={t('analytics.reset')}
        dateFromLabel={t('analytics.dateFrom')}
        dateToLabel={t('analytics.dateTo')}
        presets={PRESETS}
        appliedPreset={appliedPreset}
        pendingPreset={preset}
        appliedLabel={rangeLabel}
        dateFrom={customFrom}
        dateTo={customTo}
        canApply={canApply}
        onOpen={() => setPreset(appliedPreset)}
        onQuickSelect={selectQuickPreset}
        onPendingPresetChange={setPreset}
        onDateFromChange={setCustomFrom}
        onDateToChange={setCustomTo}
        onApply={applyFilters}
        onSecondaryAction={resetFilters}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalSessions}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t('personnel.totalTasks')}</div>
          {prevStats && <div className="mt-1 flex justify-center"><ComparisonBadge current={stats.totalSessions} prev={prevStats.totalSessions} higherIsBetter /></div>}
        </Card>

        <Card padding="sm" className="text-center">
          {stats.avgDiff !== null ? (
            <>
              <div className="flex justify-center mb-0.5">
                <PerformanceDiff diffMinutes={Number(stats.avgDiff)} variant="metric" />
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgDifference')}</div>
              {prevStats?.avgDiff !== null && prevStats !== null && <div className="mt-1 flex justify-center"><ComparisonBadge current={Number(stats.avgDiff)} prev={Number(prevStats.avgDiff)} /></div>}
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-300">–</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgDifference')}</div>
            </>
          )}
        </Card>

        <Card padding="sm" className="text-center">
          {stats.avgActualPerColli !== null ? (
            <>
              <div className="text-2xl font-bold text-gray-900">{formatDurationWithSeconds(Number(stats.avgActualPerColli))}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('personnel.avgPerColli')}</div>
              {prevStats?.avgActualPerColli !== null && prevStats !== null && <div className="mt-1 flex justify-center"><ComparisonBadge current={Number(stats.avgActualPerColli)} prev={Number(prevStats.avgActualPerColli)} /></div>}
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-300">–</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('personnel.avgPerColli')}</div>
            </>
          )}
        </Card>

        {/* Rating card */}
        <Card padding="sm" className="col-span-3">
          {hasRating && avgOverall !== null ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-gray-900 tabular-nums">{avgOverall.toFixed(1)}</div>
                <div>
                  <StarDisplay value={avgOverall} size="md" />
                  <div className="text-xs text-gray-500 mt-0.5">{t('personnel.avgRating')}</div>
                </div>
              </div>
              <button type="button" onClick={() => setShowRatingDetails(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0">
                {t('ratings.showDetails')}
              </button>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-bold text-gray-300">–</div>
              <div className="text-xs text-gray-500">{t('personnel.avgRating')}</div>
            </div>
          )}
        </Card>
      </div>

      {/* Department breakdown — collapsible with chip preview */}
      {deptStats.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDepts((v) => !v)} className="w-full text-left">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {t('analytics.byDepartment')}
              </h2>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-400">{deptStats.length}</span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showDepts ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {/* Always-visible chip preview */}
            {!showDepts && (
              <div className="flex flex-wrap gap-1.5">
                {deptStats.slice(0, 4).map(({ department }) => (
                  <span key={department} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {getDepartmentLabel(department, lang)}
                  </span>
                ))}
                {deptStats.length > 4 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                    +{deptStats.length - 4}
                  </span>
                )}
              </div>
            )}
          </button>
          {showDepts && (
            <Card padding="none" className="mt-2">
              <div className="divide-y divide-gray-100">
                {deptStats.map(({ department, sessionCount, avgDiff: diff }) => (
                  <div key={department} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{getDepartmentLabel(department, lang)}</div>
                      <div className="text-xs text-gray-500">{sessionCount} {t('analytics.sessionCount')}</div>
                    </div>
                    <PerformanceDiff diffMinutes={diff === null ? 0 : diff} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Comments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {t('personnel.comments')}
            {commentsTotal > 0 && <span className="ml-1.5 text-gray-400 font-medium normal-case tracking-normal">({commentsTotal})</span>}
          </h2>
          <div className="flex items-center gap-2">
            {commentsTotal > 3 && (
              <Link href={`/personnel/${data.id}/comments`} className="text-xs font-semibold transition-colors hidden sm:block" style={{ color: '#1C7745' }}>
                {t('personnel.showAllComments')}
              </Link>
            )}
            <button type="button" onClick={() => setShowAddComment(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              <span className="hidden sm:inline">{t('personnel.addComment')}</span>
              <span className="sm:hidden">{lang === 'nl' ? 'Nieuw' : 'New'}</span>
            </button>
          </div>
        </div>

        {commentsLoading ? (
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {[1, 2].map((i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </Card>
        ) : comments.length === 0 ? (
          <Card padding="sm">
            <EmptyState title={t('personnel.noComments')} />
          </Card>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {comments.map((c) => (
                <div key={c.id} className="px-4 py-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-800 flex-1 leading-relaxed">{c.content}</p>
                    <button type="button" onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 shrink-0 mt-0.5" aria-label={t('personnel.deleteComment')}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{formatRelativeTime(c.createdAt, lang)}</div>
                </div>
              ))}
            </div>
            {commentsTotal > 3 && (
              <Link href={`/personnel/${data.id}/comments`} className="flex items-center justify-center gap-1 py-2.5 text-xs font-semibold border-t border-gray-100 transition-colors hover:bg-gray-50" style={{ color: '#1C7745' }}>
                {t('personnel.showAllComments')} ({commentsTotal})
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </Link>
            )}
          </Card>
        )}
      </div>

      {/* Recent tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {t('personnel.recentTasks')}
          </h2>
        </div>
        {recentCompleted.length === 0 ? (
          <Card padding="sm">
            <EmptyState title={stats.totalSessions === 0 ? t('personnel.noDataForPeriod') : t('personnel.noHistory')} />
          </Card>
        ) : (
          <div className="space-y-2">
            {recentCompleted.map((s) => {
              const perfColor = s.performanceDiff === null ? '#D1D5DB' : Number(s.performanceDiff) <= 0 ? '#80BC17' : '#E40B17'
              return (
                <Link key={s.id} href={`/tasks/${s.taskId}`} className="block">
                  <TaskSummaryCard
                    className="hover:border-gray-300 transition-colors"
                    accentColor={perfColor}
                    title={getDepartmentLabel(s.department, lang)}
                    subtitle={`${formatDate(s.workDate)} · ${s.colliCount} ${t('tasks.colli')}`}
                    metaBadgeLabel={s.discountContainer ? t('tasks.discountContainerBadge') : undefined}
                    onMetaBadgeClick={s.discountContainer ? () => setShowDiscountInfo(true) : undefined}
                    startTime={formatTime(s.startedAt)}
                    endTime={s.endedAt ? formatTime(s.endedAt) : null}
                    plannedEndTime={s.endedAt ? formatTime(new Date(new Date(s.startedAt).getTime() + Number(s.expectedSessionMinutes ?? s.expectedMinutes) * 60000)) : undefined}
                    plannedLabel={t('tasks.planned')}
                    duration={s.actualMinutes !== null ? formatDuration(Number(s.actualMinutes)) : null}
                    diffMinutes={s.performanceDiff !== null ? Number(s.performanceDiff) : null}
                  />
                </Link>
              )
            })}
          </div>
        )}
        {hasMoreTasks && (
          <Link href={`/personnel/${data.id}/tasks`} className="mt-2 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
            {t('personnel.showAllTasks')} ({data.total})
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </Link>
        )}
      </div>

      {/* Rating details sheet */}
      <ModalOrSheet open={showRatingDetails} onClose={() => setShowRatingDetails(false)}>
        <div className="space-y-5">
          <h2 className="text-lg font-bold text-gray-900">{t('ratings.detailsTitle')}</h2>
          {hasRating && avgOverall !== null ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">{t('ratings.overallScore')}</div>
                <div className="flex items-center gap-3">
                  <StarDisplay value={avgOverall} size="md" />
                  <span className="text-lg font-bold text-gray-900 tabular-nums">{avgOverall.toFixed(1)}</span>
                </div>
              </div>
              {[
                { label: t('ratings.workEthicLabel'), hint: t('ratings.workEthicHint'), value: data.avgWorkEthic },
                { label: t('ratings.qualityLabel'), hint: t('ratings.qualityHint'), value: data.avgQuality },
                { label: t('ratings.teamworkLabel'), hint: t('ratings.teamworkHint'), value: data.avgTeamwork },
              ].map(({ label, hint, value }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{label}</div>
                    <div className="text-xs text-gray-500">{hint}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StarDisplay value={value ?? 0} />
                    <span className="text-sm font-bold text-gray-900 tabular-nums w-7 text-right">
                      {value !== null ? value.toFixed(1) : '–'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('ratings.noRatingDetails')}</p>
          )}
        </div>
      </ModalOrSheet>

      {/* Add comment sheet */}
      <ModalOrSheet open={showAddComment} onClose={() => { setShowAddComment(false); setNewComment('') }}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{t('personnel.addComment')}</h2>
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t('personnel.commentPlaceholder')} rows={4} autoFocus className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none" style={{ '--tw-ring-color': '#80BC17' } as React.CSSProperties} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowAddComment(false); setNewComment('') }} className="flex-1" disabled={savingComment}>{t('personnel.cancel')}</Button>
            <Button onClick={saveComment} loading={savingComment} disabled={!newComment.trim()} className="flex-1">{t('personnel.save')}</Button>
          </div>
        </div>
      </ModalOrSheet>

      <ModalOrSheet open={showDiscountInfo} onClose={() => setShowDiscountInfo(false)}>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.discountContainerTitle')}</h2>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerDescription')}</p>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerNote')}</p>
        </div>
      </ModalOrSheet>

    </div>
  )
}

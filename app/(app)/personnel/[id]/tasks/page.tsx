'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TaskSummaryCard } from '@/components/ui/TaskSummaryCard'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDate, formatDuration } from '@/lib/business'
import { apiFetch } from '@/lib/api'

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

interface PersonnelInfo {
  id: string
  fullName: string
}

interface PageData {
  id: string
  fullName: string
  sessions: SessionDetail[]
  total: number
  page: number
  limit: number
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

export default function PersonnelTasksPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()

  const [info, setInfo] = useState<PersonnelInfo | null>(null)
  const [sessions, setSessions] = useState<SessionDetail[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showDiscountInfo, setShowDiscountInfo] = useState(false)

  const [preset, setPreset] = useState<Preset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedPreset, setAppliedPreset] = useState<Preset>('all')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const PAGE_SIZE = 20

  const buildUrl = useCallback((p: number, ap: Preset, af: string, at: string) => {
    const range = getPresetRange(ap, af, at)
    const qs = new URLSearchParams()
    qs.set('page', String(p))
    qs.set('limit', String(PAGE_SIZE))
    if (range) {
      qs.set('dateFrom', range.dateFrom)
      qs.set('dateTo', range.dateTo)
    }
    return `/api/personnel/${params.id}?${qs}`
  }, [params.id])

  const load = useCallback(async (ap: Preset, af: string, at: string) => {
    setLoading(true)
    setPage(1)
    try {
      const res = await apiFetch(buildUrl(1, ap, af, at))
      if (res.ok) {
        const data: PageData = await res.json()
        setInfo({ id: data.id, fullName: data.fullName })
        setSessions(data.sessions.filter((s) => s.endedAt))
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  const loadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await apiFetch(buildUrl(nextPage, appliedPreset, appliedFrom, appliedTo))
      if (res.ok) {
        const data: PageData = await res.json()
        setSessions((prev) => [...prev, ...data.sessions.filter((s) => s.endedAt)])
        setPage(nextPage)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void load(appliedPreset, appliedFrom, appliedTo)
  }, [load, appliedPreset, appliedFrom, appliedTo])

  const customRangeValid = customFrom !== '' && customTo !== '' && customFrom <= customTo
  const canApply = preset !== 'custom' || customRangeValid

  const applyFilters = () => {
    if (!canApply) return
    setAppliedPreset(preset)
    setAppliedFrom(customFrom)
    setAppliedTo(customTo)
    setShowFilters(false)
  }

  const PRESETS: { key: Preset; label: string }[] = [
    { key: '7d', label: t('personnel.last7d') },
    { key: '14d', label: t('personnel.last14d') },
    { key: '30d', label: t('personnel.last30d') },
    { key: '90d', label: t('personnel.last90d') },
    { key: 'all', label: t('personnel.allTime') },
    { key: 'custom', label: t('personnel.customRange') },
  ]

  const hasMore = sessions.length < total

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/personnel/${params.id}`}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0"
          aria-label={t('common.back')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{t('personnel.allTasksTitle')}</h1>
          {info && <div className="text-sm text-gray-500 truncate">{info.fullName}</div>}
        </div>
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

      {/* Sessions list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} padding="sm" className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56" />
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState title={t('personnel.noHistory')} />
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {sessions.map((s) => {
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
                    metaBadgeLabel={s.discountContainer ? t('tasks.discountContainerBadge') : undefined}
                    onMetaBadgeClick={s.discountContainer ? () => setShowDiscountInfo(true) : undefined}
                    startTime={formatTime(s.startedAt)}
                    endTime={s.endedAt ? formatTime(s.endedAt) : null}
                    plannedEndTime={s.endedAt
                      ? formatTime(new Date(
                        new Date(s.startedAt).getTime()
                        + Number(s.expectedSessionMinutes ?? s.expectedMinutes) * 60000,
                      ))
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
            <div className="flex justify-center">
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadMore}>
                {t('common.loadMore')} ({total - sessions.length})
              </Button>
            </div>
          )}
        </>
      )}

      <ModalOrSheet open={showDiscountInfo} onClose={() => setShowDiscountInfo(false)}>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.discountContainerTitle')}</h2>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerDescription')}</p>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerNote')}</p>
        </div>
      </ModalOrSheet>

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
                  (preset === p.key || (p.key === appliedPreset && preset === p.key))
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

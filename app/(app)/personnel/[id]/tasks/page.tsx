'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TaskSummaryCard } from '@/components/ui/TaskSummaryCard'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { TimeRangeFilter } from '@/components/ui/TimeRangeFilter'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDate, formatDuration } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import { getAppliedTimeFilter, getTimePresetRange, type TimePreset } from '@/lib/timeRange'

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

export default function PersonnelTasksPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()
  const defaultFilter = getAppliedTimeFilter('all', '', '')

  const [info, setInfo] = useState<PersonnelInfo | null>(null)
  const [sessions, setSessions] = useState<SessionDetail[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showDiscountInfo, setShowDiscountInfo] = useState(false)

  const [preset, setPreset] = useState<TimePreset>(defaultFilter.preset)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [appliedPreset, setAppliedPreset] = useState<TimePreset>(defaultFilter.preset)
  const [appliedFrom, setAppliedFrom] = useState(defaultFilter.dateFrom)
  const [appliedTo, setAppliedTo] = useState(defaultFilter.dateTo)

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
    const next = getAppliedTimeFilter(preset, customFrom, customTo)
    setAppliedPreset(next.preset)
    setAppliedFrom(next.dateFrom)
    setAppliedTo(next.dateTo)
  }

  const resetFilters = () => {
    setPreset(defaultFilter.preset)
    setCustomFrom('')
    setCustomTo('')
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

  const PRESETS: { key: TimePreset; label: string }[] = [
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
        <BackButton
          fallbackHref={`/personnel/${params.id}`}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0"
          aria-label={t('common.back')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </BackButton>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{t('personnel.allTasksTitle')}</h1>
          {info && <div className="text-sm text-gray-500 truncate">{info.fullName}</div>}
        </div>
      </div>

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
        appliedLabel={
          appliedPreset === 'all'
            ? t('personnel.allTime')
            : appliedPreset === 'custom' && appliedFrom && appliedTo
              ? `${appliedFrom} – ${appliedTo}`
              : PRESETS.find((presetOption) => presetOption.key === appliedPreset)?.label ?? ''
        }
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

    </div>
  )
}

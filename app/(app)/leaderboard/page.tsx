'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { TimeRangeFilter } from '@/components/ui/TimeRangeFilter'
import { formatDurationWithSeconds } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import { getAppliedTimeFilter, type TimePreset } from '@/lib/timeRange'

interface PersonnelStat {
  personnelId: string
  personnelName: string
  sessionCount: number
  avgActualPerColli: number | null
}

const RANK_STYLES = [
  { bg: '#FFFBEB', color: '#92400E', badge: '#FCD34D' },
  { bg: '#F8FAFC', color: '#475569', badge: '#CBD5E1' },
  { bg: '#FFF7ED', color: '#9A3412', badge: '#FDBA74' },
]

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function LeaderboardPage() {
  const { t, lang } = useLanguage()
  const defaultFilter = getAppliedTimeFilter('30d', '', '')
  const [preset, setPreset] = useState<TimePreset>(defaultFilter.preset)
  const [customFrom, setCustomFrom] = useState(defaultFilter.dateFrom)
  const [customTo, setCustomTo] = useState(defaultFilter.dateTo)
  const [appliedPreset, setAppliedPreset] = useState<TimePreset>(defaultFilter.preset)
  const [appliedFrom, setAppliedFrom] = useState(defaultFilter.dateFrom)
  const [appliedTo, setAppliedTo] = useState(defaultFilter.dateTo)
  const [personnel, setPersonnel] = useState<PersonnelStat[]>([])
  const [loading, setLoading] = useState(true)

  const presets: { key: TimePreset; label: string }[] = [
    { key: '7d', label: t('personnel.last7d') },
    { key: '14d', label: t('personnel.last14d') },
    { key: '30d', label: t('personnel.last30d') },
    { key: '90d', label: t('personnel.last90d') },
    { key: 'all', label: t('personnel.allTime') },
    { key: 'custom', label: t('personnel.customRange') },
  ]

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (appliedFrom) params.set('dateFrom', appliedFrom)
        if (appliedTo) params.set('dateTo', appliedTo)
        const res = await apiFetch(`/api/analytics?${params}`)
        if (!cancelled && res.ok) {
          const json = await res.json()
          const sorted = ((json.byPersonnel ?? []) as PersonnelStat[])
            .filter((p) => p.avgActualPerColli !== null)
            .sort((a, b) => (a.avgActualPerColli ?? Infinity) - (b.avgActualPerColli ?? Infinity))
          setPersonnel(sorted)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [appliedFrom, appliedTo])

  const applyDraft = () => {
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

  const appliedLabel = appliedPreset === 'all'
    ? t('personnel.allTime')
    : appliedPreset === 'custom'
      ? `${appliedFrom} – ${appliedTo}`
      : presets.find((presetOption) => presetOption.key === appliedPreset)?.label ?? ''

  const customRangeValid = customFrom !== '' && customTo !== '' && customFrom <= customTo
  const canApply = preset !== 'custom' || customRangeValid

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'nl' ? 'Ranglijst' : 'Leaderboard'}
        action={(
          <TimeRangeFilter
            title={t('analytics.filters')}
            filterLabel={t('common.filters')}
            applyLabel={t('analytics.apply')}
            secondaryLabel={t('analytics.reset')}
            dateFromLabel={t('analytics.dateFrom')}
            dateToLabel={t('analytics.dateTo')}
            presets={presets}
            appliedPreset={appliedPreset}
            pendingPreset={preset}
            appliedLabel={appliedLabel}
            dateFrom={customFrom}
            dateTo={customTo}
            canApply={canApply}
            showQuickPresets={false}
            onOpen={() => setPreset(appliedPreset)}
            onQuickSelect={selectQuickPreset}
            onPendingPresetChange={setPreset}
            onDateFromChange={setCustomFrom}
            onDateToChange={setCustomTo}
            onApply={applyDraft}
            onSecondaryAction={resetFilters}
          />
        )}
      />

      {loading ? (
        <Card padding="none">
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </Card>
      ) : personnel.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-sm text-gray-500">{t('analytics.noData')}</div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-gray-100">
            {personnel.map((p, idx) => {
              const rank = idx + 1
              const style = idx < 3 ? RANK_STYLES[idx] : null

              return (
                <Link
                  key={p.personnelId}
                  href={`/personnel/${p.personnelId}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  {/* Rank badge */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={
                      style
                        ? { backgroundColor: style.badge, color: style.color }
                        : { backgroundColor: '#F3F4F6', color: '#9CA3AF' }
                    }
                  >
                    {rank}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={
                      style
                        ? { backgroundColor: style.badge + '60', color: style.color }
                        : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                    }
                  >
                    {initials(p.personnelName)}
                  </div>

                  {/* Name + sessions */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{p.personnelName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.sessionCount} {lang === 'nl' ? 'sessies' : 'sessions'}
                    </div>
                  </div>

                  {/* Time per colli */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatDurationWithSeconds(p.avgActualPerColli!)}
                    </div>
                    <div className="text-[10px] text-gray-400">/ colli</div>
                  </div>

                  {/* Chevron */}
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

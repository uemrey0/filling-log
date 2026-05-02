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
  {
    badge: '#E8BC45',
    badgeText: '#7B5A11',
    avatarBg: '#ECF4DB',
    avatarText: '#526A20',
    pillar: 'linear-gradient(180deg, #F2D56D 0%, #E7BF47 100%)',
  },
  {
    badge: '#D7D3CE',
    badgeText: '#5F5C57',
    avatarBg: '#ECF4DB',
    avatarText: '#526A20',
    pillar: 'linear-gradient(180deg, #E3E0DB 0%, #CBC7C2 100%)',
  },
  {
    badge: '#C98B50',
    badgeText: '#69401A',
    avatarBg: '#ECF4DB',
    avatarText: '#526A20',
    pillar: 'linear-gradient(180deg, #D8A36C 0%, #BE8042 100%)',
  },
]

const PODIUM_LAYOUT = [
  { sourceIndex: 1, rank: 2, columnClassName: 'pt-8', pillarHeight: 'h-24 sm:h-28' },
  { sourceIndex: 0, rank: 1, columnClassName: '', pillarHeight: 'h-32 sm:h-36' },
  { sourceIndex: 2, rank: 3, columnClassName: 'pt-12', pillarHeight: 'h-20 sm:h-24' },
]

function sessionLabel(count: number, lang: string) {
  return `${count} ${lang === 'nl' ? 'sessies' : 'sessions'}`
}

export default function LeaderboardPage() {
  const { t, lang } = useLanguage()
  const defaultFilter = getAppliedTimeFilter('7d', '', '')
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
        const res = await apiFetch(`/api/analytics/personnel?${params}`)
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
  const remainingPersonnel = personnel.slice(3)
  const podiumEntries = PODIUM_LAYOUT
    .map((item) => ({
      ...item,
      person: personnel[item.sourceIndex],
      style: RANK_STYLES[item.rank - 1]!,
    }))
    .filter((item) => item.person)

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
        <div className="space-y-4">
          <Card className="overflow-hidden" padding="none">
            <div className="grid grid-cols-3 items-end gap-3 px-4 pt-5 pb-5 sm:gap-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className={`flex flex-col items-center ${index === 0 ? 'pt-8' : index === 2 ? 'pt-12' : ''}`}
                >
                  <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
                  <Skeleton className="mt-4 h-4 w-16 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-14 rounded-full" />
                  <Skeleton className="mt-4 h-9 w-9 rounded-full" />
                  <Skeleton
                    className={`mt-3 w-full rounded-t-2xl ${
                      index === 1 ? 'h-32 sm:h-36' : index === 0 ? 'h-24 sm:h-28' : 'h-20 sm:h-24'
                    }`}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : personnel.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-sm text-gray-500">{t('analytics.noData')}</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {podiumEntries.length > 0 && (
            <Card
              className="overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
              padding="none"
              style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F1F1ED 55%, #ECECE7 100%)' }}
            >
              <div className="grid grid-cols-3 items-end gap-3 px-4 pt-5 pb-5 sm:gap-5">
                {podiumEntries.map(({ rank, person, style, columnClassName, pillarHeight }) => (
                  <div key={person!.personnelId} className={`flex flex-col items-center ${columnClassName}`}>
                    <div className="text-center">
                      <div className="truncate text-lg font-bold leading-tight text-gray-900 sm:text-xl">
                        {person!.personnelName}
                      </div>
                      <div className="mt-1 text-sm font-bold tabular-nums text-gray-700">
                        {formatDurationWithSeconds(person!.avgActualPerColli!)}
                        <span className="ml-1 text-[10px] font-medium text-gray-400">/ colli</span>
                      </div>
                    </div>

                    <div
                      className="mt-4 flex h-10 w-10 items-center justify-center rounded-full text-lg font-black shadow-[0_6px_12px_rgba(15,23,42,0.08)] sm:h-11 sm:w-11"
                      style={{ backgroundColor: style.badge, color: style.badgeText }}
                    >
                      {rank}
                    </div>

                    <div
                      className={`mt-3 w-full rounded-t-2xl ${pillarHeight}`}
                      style={{ background: style.pillar }}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {remainingPersonnel.map((p, idx) => {
                const rank = idx + 4
                const style = null

                return (
                  <Link
                    key={p.personnelId}
                    href={`/personnel/${p.personnelId}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 active:bg-gray-100"
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black"
                      style={
                        style
                          ? { backgroundColor: style.badge, color: style.badgeText }
                          : { backgroundColor: '#F3F4F6', color: '#7A7A7A' }
                      }
                    >
                      {rank}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">{p.personnelName}</div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {sessionLabel(p.sessionCount, lang)}
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-bold tabular-nums text-gray-900">
                        {formatDurationWithSeconds(p.avgActualPerColli!)}
                        <span className="ml-1 text-[10px] font-medium text-gray-400">/ colli</span>
                      </div>
                    </div>

                    <svg className="h-4 w-4 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { Skeleton } from '@/components/ui/Skeleton'
import { TimeRangeFilter } from '@/components/ui/TimeRangeFilter'
import { getDepartmentLabel } from '@/lib/departments'
import { formatDuration } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import { getAppliedTimeFilter, type TimePreset } from '@/lib/timeRange'

interface OverviewStats {
  totalSessions: number
  avgExpectedMinutes: number | null
  avgActualMinutes: number | null
  avgDiffMinutes: number | null
}

interface DepartmentStat {
  department: string
  sessionCount: number
  avgExpected: number | null
  avgActual: number | null
  avgDiff: number | null
}

interface AnalyticsData {
  overview: OverviewStats
  byDepartment: DepartmentStat[]
}

export default function AnalyticsPage() {
  const { t, lang } = useLanguage()
  const defaultFilter = getAppliedTimeFilter('30d', '', '')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<TimePreset>(defaultFilter.preset)
  const [customFrom, setCustomFrom] = useState(defaultFilter.dateFrom)
  const [customTo, setCustomTo] = useState(defaultFilter.dateTo)
  const [appliedPreset, setAppliedPreset] = useState<TimePreset>(defaultFilter.preset)
  const [appliedFrom, setAppliedFrom] = useState(defaultFilter.dateFrom)
  const [appliedTo, setAppliedTo] = useState(defaultFilter.dateTo)

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
        if (!cancelled && res.ok) setData(await res.json())
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
        title={t('analytics.title')}
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
        <>
          <div>
            <Skeleton className="h-3 w-24 mb-3" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Card key={`ov-sk-${idx}`} padding="sm" className="text-center space-y-2">
                  <Skeleton className="h-7 w-16 mx-auto" />
                  <Skeleton className="h-3 w-24 mx-auto" />
                </Card>
              ))}
            </div>
          </div>
          <div>
            <Skeleton className="h-3 w-28 mb-3" />
            <Card padding="none">
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`dept-sk-${idx}`} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : !data || data.overview.totalSessions === 0 ? (
        <Card>
          <div className="text-center py-12 text-sm text-gray-500">{t('analytics.noData')}</div>
        </Card>
      ) : (
        <>
          {/* Overview */}
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              {t('analytics.overview')}
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card padding="sm" className="text-center">
                <div className="text-2xl font-bold text-gray-900">{data.overview.totalSessions}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('analytics.completedSessions')}</div>
              </Card>
              <Card padding="sm" className="text-center">
                <div className="flex justify-center items-center" style={{ minHeight: '2rem' }}>
                  <PerformanceDiff diffMinutes={Number(data.overview.avgDiffMinutes)} />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgDifference')}</div>
              </Card>
              <Card padding="sm" className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  {formatDuration(Number(data.overview.avgExpectedMinutes))}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgExpected')}</div>
              </Card>
              <Card padding="sm" className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  {formatDuration(Number(data.overview.avgActualMinutes))}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgActual')}</div>
              </Card>
            </div>
          </div>

          {/* By department */}
          {data.byDepartment.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                {t('analytics.byDepartment')}
              </h2>
              <Card padding="none">
                <div className="divide-y divide-gray-100">
                  {data.byDepartment.map((row) => (
                    <div key={row.department} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900">
                          {getDepartmentLabel(row.department, lang)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {row.sessionCount} {t('analytics.sessionCount')}
                          {row.avgActual !== null && ` · ${formatDuration(Number(row.avgActual))}`}
                        </div>
                      </div>
                      <PerformanceDiff diffMinutes={Number(row.avgDiff)} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

    </div>
  )
}

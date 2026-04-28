'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { getDepartmentLabel } from '@/lib/departments'
import { formatDuration } from '@/lib/business'
import { apiFetch } from '@/lib/api'

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

function getDefaultDateRange() {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const thirtyDaysAgoDate = new Date(now)
  thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30)
  const thirtyDaysAgo = thirtyDaysAgoDate.toISOString().slice(0, 10)
  return { today, thirtyDaysAgo }
}

export default function AnalyticsPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const [{ today, thirtyDaysAgo }] = useState(getDefaultDateRange)

  const [filters, setFilters] = useState({
    dateFrom: thirtyDaysAgo,
    dateTo: today,
  })
  const [applied, setApplied] = useState(filters)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (applied.dateFrom) params.set('dateFrom', applied.dateFrom)
        if (applied.dateTo) params.set('dateTo', applied.dateTo)
        const res = await apiFetch(`/api/analytics?${params}`)
        if (!cancelled && res.ok) setData(await res.json())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [applied])

  const handleApply = () => {
    setApplied({ ...filters })
    setShowFilters(false)
  }

  const handleReset = () => {
    const reset = { dateFrom: thirtyDaysAgo, dateTo: today }
    setFilters(reset)
    setApplied(reset)
    setShowFilters(false)
  }

  const hasActiveFilter = applied.dateFrom !== thirtyDaysAgo || applied.dateTo !== today

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('analytics.title')}
        action={
          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-colors"
            style={
              hasActiveFilter
                ? { backgroundColor: '#80BC17', color: '#fff', borderColor: '#80BC17' }
                : { backgroundColor: '#fff', color: '#374151', borderColor: '#E5E7EB' }
            }
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {t('common.filters')}
          </button>
        }
      />

      {hasActiveFilter && (
        <div className="flex flex-wrap gap-2">
          {(applied.dateFrom !== thirtyDaysAgo || applied.dateTo !== today) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
              {applied.dateFrom} – {applied.dateTo}
              <button onClick={() => { const d = { dateFrom: thirtyDaysAgo, dateTo: today }; setFilters((f) => ({ ...f, ...d })); setApplied((a) => ({ ...a, ...d })) }} className="text-gray-400 hover:text-gray-700">×</button>
            </span>
          )}
        </div>
      )}

      {loading ? (
        <>
          <div>
            <Skeleton className="h-3 w-24 mb-3" />
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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

      {/* Filter sheet */}
      <ModalOrSheet open={showFilters} onClose={() => setShowFilters(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{t('analytics.filters')}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateFrom')}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateTo')}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button onClick={handleApply} className="flex-1">{t('analytics.apply')}</Button>
            <Button variant="secondary" onClick={handleReset} className="flex-1">{t('analytics.reset')}</Button>
          </div>
        </div>
      </ModalOrSheet>
    </div>
  )
}

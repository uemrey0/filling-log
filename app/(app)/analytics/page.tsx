'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/ui/PageHeader'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { PersonnelSearchSelect } from '@/components/ui/PersonnelSearchSelect'
import { getDepartmentLabel, DEPARTMENT_KEYS } from '@/lib/departments'
import { formatDuration, formatDate } from '@/lib/business'
import type { Personnel } from '@/lib/db/schema'

interface OverviewStats {
  totalSessions: number
  avgExpectedMinutes: number
  avgActualMinutes: number
  avgDiffMinutes: number
}

interface PersonnelStat {
  personnelId: string
  personnelName: string
  sessionCount: number
  avgExpected: number
  avgActual: number
  avgDiff: number
}

interface DepartmentStat {
  department: string
  sessionCount: number
  avgExpected: number
  avgActual: number
  avgDiff: number
}

interface DailyStat {
  date: string
  sessionCount: number
  avgDiff: number
}

interface AnalyticsData {
  overview: OverviewStats
  byPersonnel: PersonnelStat[]
  byDepartment: DepartmentStat[]
  daily: DailyStat[]
}

export default function AnalyticsPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [personnel, setPersonnel] = useState<Personnel[]>([])

  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [filters, setFilters] = useState({
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    personnelId: '',
    department: '',
  })

  const [applied, setApplied] = useState(filters)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (applied.dateFrom) params.set('dateFrom', applied.dateFrom)
      if (applied.dateTo) params.set('dateTo', applied.dateTo)
      if (applied.personnelId) params.set('personnelId', applied.personnelId)
      if (applied.department) params.set('department', applied.department)
      const res = await fetch(`/api/analytics?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/personnel')
      .then((r) => r.json())
      .then(setPersonnel)
      .catch(() => {})
  }, [])

  const handleApply = () => setApplied({ ...filters })
  const handleReset = () => {
    const reset = { dateFrom: thirtyDaysAgo, dateTo: today, personnelId: '', department: '' }
    setFilters(reset)
    setApplied(reset)
  }

  const departmentOptions = [
    { value: '', label: t('analytics.allDepartments') },
    ...DEPARTMENT_KEYS.map((k) => ({ value: k, label: getDepartmentLabel(k, lang) })),
  ]

  return (
    <div className="space-y-5">
      <PageHeader title={t('analytics.title')} />

      {/* Filters */}
      <Card padding="md">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('analytics.filters')}</h2>
        <div className="space-y-3">
          {/* Date range - stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateFrom')}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateTo')}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Personnel search */}
          <PersonnelSearchSelect
            personnel={personnel}
            value={filters.personnelId}
            onChange={(id) => setFilters((f) => ({ ...f, personnelId: id }))}
            label={t('analytics.allPersonnel')}
            allLabel={t('analytics.allPersonnel')}
          />

          {/* Department */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.allDepartments')}</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {departmentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <Button fullWidth onClick={handleApply}>{t('analytics.apply')}</Button>
            <Button variant="secondary" onClick={handleReset}>{t('analytics.reset')}</Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-primary" />
        </div>
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

          {/* By personnel */}
          {data.byPersonnel.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                {t('analytics.byPersonnel')}
              </h2>
              <Card padding="none">
                <div className="divide-y divide-gray-100">
                  {data.byPersonnel.map((row) => (
                    <div key={row.personnelId} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#80BC17' + '20', color: '#1C7745' }}
                        >
                          {row.personnelName.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">{row.personnelName}</div>
                          <div className="text-xs text-gray-500">
                            {row.sessionCount} {t('analytics.sessionCount')} · {formatDuration(Number(row.avgActual))}
                          </div>
                        </div>
                      </div>
                      <PerformanceDiff diffMinutes={Number(row.avgDiff)} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

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
                        <div className="text-xs text-gray-500">
                          {row.sessionCount} {t('analytics.sessionCount')} · {formatDuration(Number(row.avgActual))}
                        </div>
                      </div>
                      <PerformanceDiff diffMinutes={Number(row.avgDiff)} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Daily */}
          {data.daily.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                {t('analytics.dailyOverview')}
              </h2>
              <Card padding="none">
                <div className="divide-y divide-gray-100">
                  {data.daily.map((row) => (
                    <div key={row.date} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{formatDate(row.date)}</div>
                        <div className="text-xs text-gray-500">{row.sessionCount} {t('analytics.sessionCount')}</div>
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

'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { getDepartmentLabel, DEPARTMENT_KEYS } from '@/lib/departments'
import { formatDuration, formatDurationWithSeconds } from '@/lib/business'
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

interface PersonnelStat {
  personnelId: string
  personnelName: string
  sessionCount: number
  avgExpected: number | null
  avgActual: number | null
  avgDiff: number | null
  avgActualPerColli: number | null
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

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

const RANK_STYLES = [
  { bg: '#FFFBEB', color: '#92400E', badge: '#FCD34D' },
  { bg: '#F8FAFC', color: '#475569', badge: '#CBD5E1' },
  { bg: '#FFF7ED', color: '#9A3412', badge: '#FDBA74' },
]

export default function AnalyticsPage() {
  const { t, lang } = useLanguage()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const [{ today, thirtyDaysAgo }] = useState(getDefaultDateRange)

  const [filters, setFilters] = useState({
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    department: '',
  })

  const [applied, setApplied] = useState(filters)

  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedDeptLabel, setSelectedDeptLabel] = useState('')
  const [deptPersonnel, setDeptPersonnel] = useState<PersonnelStat[]>([])
  const [deptLoading, setDeptLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (applied.dateFrom) params.set('dateFrom', applied.dateFrom)
        if (applied.dateTo) params.set('dateTo', applied.dateTo)
        if (applied.department) params.set('department', applied.department)
        const res = await apiFetch(`/api/analytics?${params}`)
        if (!cancelled && res.ok) setData(await res.json())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [applied])

  useEffect(() => {
    if (!selectedDept) return
    let cancelled = false
    const load = async () => {
      setDeptLoading(true)
      setDeptPersonnel([])
      try {
        const params = new URLSearchParams()
        if (applied.dateFrom) params.set('dateFrom', applied.dateFrom)
        if (applied.dateTo) params.set('dateTo', applied.dateTo)
        params.set('department', selectedDept)
        const res = await apiFetch(`/api/analytics?${params}`)
        if (!cancelled && res.ok) {
          const json = await res.json()
          const sorted = (json.byPersonnel ?? []).sort(
            (a: PersonnelStat, b: PersonnelStat) =>
              (a.avgActualPerColli ?? Infinity) - (b.avgActualPerColli ?? Infinity),
          )
          setDeptPersonnel(sorted)
        }
      } finally {
        if (!cancelled) setDeptLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [selectedDept, applied])

  const handleApply = () => {
    setApplied({ ...filters })
    setShowFilters(false)
  }

  const handleReset = () => {
    const reset = { dateFrom: thirtyDaysAgo, dateTo: today, department: '' }
    setFilters(reset)
    setApplied(reset)
    setShowFilters(false)
  }

  const departmentOptions = [
    { value: '', label: t('analytics.allDepartments') },
    ...DEPARTMENT_KEYS.map((k) => ({ value: k, label: getDepartmentLabel(k, lang) })),
  ]

  const hasActiveFilter = applied.department || applied.dateFrom !== thirtyDaysAgo || applied.dateTo !== today

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
          {applied.department && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
              {getDepartmentLabel(applied.department, lang)}
              <button onClick={() => { setFilters((f) => ({ ...f, department: '' })); setApplied((a) => ({ ...a, department: '' })) }} className="text-gray-400 hover:text-gray-700">×</button>
            </span>
          )}
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

          {/* By department — clickable for personnel ranking */}
          {data.byDepartment.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {t('analytics.byDepartment')}
                </h2>
                <span className="text-[10px] text-gray-400 font-medium">
                  {lang === 'nl' ? 'Tik voor personeelsranking' : 'Tap to see staff ranking'}
                </span>
              </div>
              <Card padding="none">
                <div className="divide-y divide-gray-100">
                  {data.byDepartment.map((row) => (
                    <button
                      key={row.department}
                      type="button"
                      onClick={() => {
                        setSelectedDept(row.department)
                        setSelectedDeptLabel(getDepartmentLabel(row.department, lang))
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900">
                          {getDepartmentLabel(row.department, lang)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {row.sessionCount} {t('analytics.sessionCount')}
                          {row.avgActual !== null && ` · ${formatDuration(Number(row.avgActual))}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PerformanceDiff diffMinutes={Number(row.avgDiff)} />
                        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Department personnel ranking modal */}
      <ModalOrSheet open={!!selectedDept} onClose={() => setSelectedDept(null)}>
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
              {t('analytics.byDepartment')}
            </div>
            <h2 className="text-xl font-black text-gray-900">{selectedDeptLabel}</h2>
            </div>

          {deptLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : deptPersonnel.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-500">{t('analytics.noData')}</div>
          ) : (
            <div className="space-y-2">
              {deptPersonnel.map((p, idx) => {
                const rank = idx + 1
                const style = idx < 3 ? RANK_STYLES[idx] : null
                return (
                  <div
                    key={p.personnelId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                    style={
                      style
                        ? { backgroundColor: style.bg, borderColor: style.badge }
                        : { backgroundColor: '#F9FAFB', borderColor: '#F3F4F6' }
                    }
                  >
                    {/* Rank badge */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={
                        style
                          ? { backgroundColor: style.badge, color: style.color }
                          : { backgroundColor: '#E5E7EB', color: '#6B7280' }
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
                          : { backgroundColor: '#E5E7EB', color: '#6B7280' }
                      }
                    >
                      {initials(p.personnelName)}
                    </div>

                    {/* Name + session count */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{p.personnelName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {p.sessionCount} {lang === 'nl' ? 'sessies' : 'sessions'}
                      </div>
                    </div>

                    {/* Avg time per colli */}
                    {p.avgActualPerColli !== null && (
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900 tabular-nums">
                          {formatDurationWithSeconds(p.avgActualPerColli)}
                        </span>
                        <div className="text-[10px] text-gray-400 font-medium">/ colli</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </ModalOrSheet>

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

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.allDepartments')}</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {departmentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
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

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDate, formatDuration } from '@/lib/business'
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

interface PersonnelDetail extends Personnel {
  sessions: SessionDetail[]
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function PersonnelDetailPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<PersonnelDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/personnel/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" className="text-primary" /></div>
  }

  if (!data) {
    return <div className="text-center py-20 text-gray-500">{t('common.noResults')}</div>
  }

  const completed = data.sessions.filter((s) => s.endedAt && s.performanceDiff !== null)
  const active = data.sessions.filter((s) => !s.endedAt)

  const avgDiff = completed.length > 0
    ? completed.reduce((sum, s) => sum + Number(s.performanceDiff!), 0) / completed.length
    : null

  const avgActual = completed.length > 0
    ? completed.reduce((sum, s) => sum + Number(s.actualMinutes!), 0) / completed.length
    : null

  // Department breakdown
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
        <Link href={`/personnel/${data.id}/edit`}>
          <Button variant="secondary" size="sm">{t('common.edit')}</Button>
        </Link>
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

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-gray-900">{completed.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t('personnel.totalTasks')}</div>
        </Card>
        <Card padding="sm" className="text-center">
          {avgDiff !== null ? (
            <>
              <div className="flex justify-center mb-0.5">
                <PerformanceDiff diffMinutes={avgDiff} />
              </div>
              <div className="text-xs text-gray-500">{t('analytics.avgDifference')}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-gray-300">–</div>
              <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgDifference')}</div>
            </>
          )}
        </Card>
        {avgActual !== null && (
          <Card padding="sm" className="text-center">
            <div className="text-xl font-bold text-gray-900">{formatDuration(avgActual)}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t('analytics.avgActual')}</div>
          </Card>
        )}
        {deptStats.length > 0 && (
          <Card padding="sm" className="text-center">
            <div className="text-sm font-bold text-gray-900 truncate">
              {getDepartmentLabel(deptStats[0].dept, lang)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {lang === 'nl' ? 'Meeste taken' : 'Most tasks'}
            </div>
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
            <EmptyState title={t('personnel.noHistory')} />
          </Card>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {completed.slice(0, 30).map((s) => {
                const perfColor =
                  s.performanceDiff === null ? '#D1D5DB'
                  : Number(s.performanceDiff) <= 0 ? '#80BC17'
                  : '#E40B17'

                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: perfColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {getDepartmentLabel(s.department, lang)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatDate(s.workDate)} · {s.colliCount} colli · {formatTime(s.startedAt)}–{s.endedAt ? formatTime(s.endedAt) : '–'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {s.actualMinutes !== null && (
                        <div className="text-xs font-medium text-gray-700 tabular-nums mb-0.5">
                          {formatDuration(Number(s.actualMinutes))}
                        </div>
                      )}
                      {s.performanceDiff !== null && (
                        <PerformanceDiff diffMinutes={Number(s.performanceDiff)} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

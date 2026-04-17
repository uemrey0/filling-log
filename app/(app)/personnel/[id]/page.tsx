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

interface SessionSummary {
  id: string
  startedAt: string
  endedAt: string | null
  workDate: string
  taskId: string
  actualMinutes: number | null
}

interface PersonnelDetail extends Personnel {
  sessions: SessionSummary[]
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
    return (
      <div className="text-center py-20 text-gray-500">
        {t('common.noResults')}
      </div>
    )
  }

  const completedSessions = data.sessions.filter((s) => s.endedAt)
  const avgActual =
    completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0) / completedSessions.length
      : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/personnel" className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{data.fullName}</h1>
            <Badge variant={data.isActive ? 'green' : 'gray'} className="mt-1">
              {data.isActive ? t('personnel.active') : t('personnel.inactive')}
            </Badge>
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

      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-gray-900">{completedSessions.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t('personnel.totalTasks')}</div>
        </Card>
        <Card padding="sm" className="text-center">
          {avgActual !== null ? (
            <div className="text-xl font-bold text-gray-900">{formatDuration(avgActual)}</div>
          ) : (
            <div className="text-xl font-bold text-gray-400">-</div>
          )}
          <div className="text-xs text-gray-500 mt-0.5">{t('personnel.avgPerformance')}</div>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          {t('personnel.performanceHistory')}
        </h2>
        {completedSessions.length === 0 ? (
          <Card>
            <EmptyState title={t('personnel.noHistory')} />
          </Card>
        ) : (
          <div className="space-y-2">
            {completedSessions.map((s) => (
              <Card key={s.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{formatDate(s.workDate)}</div>
                    <div className="text-xs text-gray-500">
                      {formatTime(s.startedAt)} &ndash; {s.endedAt ? formatTime(s.endedAt) : '-'}
                    </div>
                  </div>
                  <div className="text-right">
                    {s.actualMinutes !== null && (
                      <div className="text-sm font-medium text-gray-900">{formatDuration(s.actualMinutes)}</div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

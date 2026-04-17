'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/ui/PageHeader'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDuration, formatDate } from '@/lib/business'

interface SessionRow {
  sessionId: string
  taskId: string
  department: string
  colliCount: number
  expectedMinutes: number
  personnelName: string
  startedAt: string
  endedAt: string | null
  workDate: string
  actualMinutes: number | null
  performanceDiff: number | null
}

export default function TasksPage() {
  const { t, lang } = useLanguage()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [endingId, setEndingId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    try {
      const res = await fetch(`/api/tasks?${params}`)
      if (res.ok) setSessions(await res.json())
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const endSession = async (sessionId: string) => {
    setEndingId(sessionId)
    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST', body: '{}' })
      await load()
    } finally {
      setEndingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('tasks.title')}
        action={
          <Link href="/tasks/new">
            <Button size="md">{t('tasks.startNew')}</Button>
          </Link>
        }
      />

      {/* Date filter */}
      <Card padding="sm">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('analytics.dateFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1 block">{t('analytics.dateTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>
              {t('analytics.reset')}
            </Button>
          )}
        </div>
      </Card>

      {sessions.length === 0 ? (
        <Card>
          <EmptyState
            title={t('tasks.noTasks')}
            action={
              <Link href="/tasks/new">
                <Button>{t('tasks.startNew')}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Card key={s.sessionId} padding="sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-black text-sm">{s.personnelName}</span>
                    {s.endedAt ? (
                      <Badge variant="gray">{t('tasks.completed')}</Badge>
                    ) : (
                      <Badge variant="green">{t('tasks.active')}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    {getDepartmentLabel(s.department, lang)} · {s.colliCount} {t('tasks.colli')}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span>{formatDate(s.workDate)}</span>
                    <span>{formatTime(s.startedAt)}{s.endedAt ? ` – ${formatTime(s.endedAt)}` : ''}</span>
                    <span>{t('tasks.expected')}: {s.expectedMinutes}m</span>
                    {s.actualMinutes !== null && (
                      <span>{t('tasks.actual')}: {formatDuration(s.actualMinutes)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {s.performanceDiff !== null && (
                    <PerformanceDiff diffMinutes={s.performanceDiff} />
                  )}
                  {!s.endedAt && (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={endingId === s.sessionId}
                      onClick={() => endSession(s.sessionId)}
                    >
                      {t('dashboard.endTask')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

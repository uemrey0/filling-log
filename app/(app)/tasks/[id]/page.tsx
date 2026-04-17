'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDate, formatDuration } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import type { Task } from '@/lib/db/schema'

interface SessionDetail {
  id: string
  personnelId: string
  personnelName: string
  startedAt: string
  endedAt: string | null
  workDate: string
  actualMinutes: number | null
  performanceDiff: number | null
}

interface TaskDetail extends Task {
  sessions: SessionDetail[]
}

export default function TaskDetailPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [endingId, setEndingId] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await apiFetch(`/api/tasks/${params.id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params.id])

  const endSession = async (sessionId: string) => {
    setEndingId(sessionId)
    try {
      await apiFetch(`/api/sessions/${sessionId}/end`, { method: 'POST', body: '{}' })
      await load()
    } finally {
      setEndingId(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" className="text-primary" /></div>
  if (!data) return <div className="text-center py-20 text-gray-500">{t('common.noResults')}</div>

  const activeSessions = data.sessions.filter((s) => !s.endedAt)
  const completedSessions = data.sessions.filter((s) => s.endedAt)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/tasks" className="text-gray-400 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-black">{getDepartmentLabel(data.department, lang)}</h1>
      </div>

      <Card padding="md">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">{t('tasks.department')}</div>
            <div className="font-semibold text-sm text-black mt-0.5">{getDepartmentLabel(data.department, lang)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('tasks.colli')}</div>
            <div className="font-semibold text-sm text-black mt-0.5">{data.colliCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('tasks.expected')}</div>
            <div className="font-semibold text-sm text-black mt-0.5">{data.expectedMinutes}m</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t('tasks.sessionCount')}</div>
            <div className="font-semibold text-sm text-black mt-0.5">{data.sessions.length}</div>
          </div>
        </div>
        {data.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">{t('tasks.notes')}</div>
            <p className="text-sm text-gray-700">{data.notes}</p>
          </div>
        )}
      </Card>

      {activeSessions.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            {t('dashboard.activeTasks')}
          </h2>
          <div className="space-y-2">
            {activeSessions.map((s) => (
              <Card key={s.id} padding="sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-black">{s.personnelName}</div>
                    <div className="text-xs text-gray-500">{t('tasks.started')}: {formatTime(s.startedAt)}</div>
                  </div>
                  <Button variant="danger" size="sm" loading={endingId === s.id} onClick={() => endSession(s.id)}>
                    {t('dashboard.endTask')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completedSessions.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            {t('tasks.completed')}
          </h2>
          <div className="space-y-2">
            {completedSessions.map((s) => (
              <Card key={s.id} padding="sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-black">{s.personnelName}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(s.workDate)} · {formatTime(s.startedAt)} – {s.endedAt ? formatTime(s.endedAt) : '-'}
                    </div>
                  </div>
                  <div className="text-right">
                    {s.actualMinutes !== null && (
                      <div className="text-sm font-semibold text-black">{formatDuration(s.actualMinutes)}</div>
                    )}
                    {s.performanceDiff !== null && <PerformanceDiff diffMinutes={s.performanceDiff} />}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

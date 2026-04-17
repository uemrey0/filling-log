'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDuration } from '@/lib/business'

interface SessionRow {
  sessionId: string
  taskId: string
  department: string
  colliCount: number
  expectedMinutes: number
  taskNotes: string | null
  personnelId: string
  personnelName: string
  startedAt: string
  endedAt: string | null
  workDate: string
  actualMinutes: number | null
  performanceDiff: number | null
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <span className="font-mono tabular-nums text-2xl font-bold text-black">--:--:--</span>

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  return (
    <span className="font-mono tabular-nums">
      <span className="text-2xl font-bold text-black">{hh}:{mm}</span>
      <span className="text-base font-semibold" style={{ color: '#80BC17' }}>:{ss}</span>
    </span>
  )
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Date.now() - start)
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const totalSec = Math.floor(elapsed / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  const hStr = h > 0 ? `${h}u ` : ''
  const mStr = String(m).padStart(h > 0 ? 2 : 1, '0')
  const sStr = String(s).padStart(2, '0')

  return (
    <span className="font-mono tabular-nums font-bold" style={{ color: '#1C7745' }}>
      {hStr}{mStr}
      <span className="font-semibold opacity-75">:{sStr}</span>
    </span>
  )
}

export default function DashboardPage() {
  const { t, lang } = useLanguage()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [endingId, setEndingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?today=true')
      if (res.ok) setSessions(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const endSession = async (sessionId: string) => {
    setEndingId(sessionId)
    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST', body: '{}' })
      await load()
    } finally {
      setEndingId(null)
    }
  }

  const active = sessions.filter((s) => !s.endedAt)
  const completed = sessions.filter((s) => s.endedAt)

  const avgDiff =
    completed.length > 0
      ? completed.reduce((sum, s) => sum + (s.performanceDiff ?? 0), 0) / completed.length
      : null

  const todayLabel = new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header met klok */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-black">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LiveClock />
          <Link href="/tasks/new">
            <Button size="md">{t('dashboard.startTask')}</Button>
          </Link>
        </div>
      </div>

      {/* Summary strip */}
      {(completed.length > 0 || active.length > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold text-black">{completed.length}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{t('dashboard.tasksCompleted')}</div>
          </Card>
          <Card padding="sm" className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#80BC17' }}>{active.length}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{t('dashboard.activeTasks')}</div>
          </Card>
          <Card padding="sm" className="text-center">
            {avgDiff !== null ? (
              <div className="flex justify-center">
                <PerformanceDiff diffMinutes={avgDiff} />
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-300">-</div>
            )}
            <div className="text-xs text-gray-500 mt-1 leading-tight">{t('dashboard.averagePerformance')}</div>
          </Card>
        </div>
      )}

      {/* Active sessions */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          {t('dashboard.activeTasks')}
        </h2>
        {active.length === 0 ? (
          <Card>
            <EmptyState
              title={t('dashboard.noActiveTasks')}
              action={
                <Link href="/tasks/new">
                  <Button size="sm">{t('dashboard.startTask')}</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((s) => (
              <Card key={s.sessionId} padding="md">
                <div className="flex gap-3">
                  <div className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#80BC17' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-black">{s.personnelName}</span>
                      <Badge variant="green">{t('tasks.active')}</Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      {getDepartmentLabel(s.department, lang)}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-lg px-2 py-2 text-center">
                        <div className="text-xs text-gray-500">{t('tasks.colli')}</div>
                        <div className="font-bold text-black text-sm mt-0.5">{s.colliCount}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-2 py-2 text-center">
                        <div className="text-xs text-gray-500">{t('tasks.expected')}</div>
                        <div className="font-bold text-black text-sm mt-0.5">{s.expectedMinutes}m</div>
                      </div>
                      <div className="rounded-lg px-2 py-2 text-center" style={{ backgroundColor: '#80BC17' + '18' }}>
                        <div className="text-xs" style={{ color: '#1C7745' }}>{t('tasks.duration')}</div>
                        <div className="text-sm mt-0.5">
                          <LiveTimer startedAt={s.startedAt} />
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">{t('tasks.started')}: {formatTime(s.startedAt)}</div>
                    <div className="mt-3">
                      <Button
                        variant="danger"
                        size="sm"
                        loading={endingId === s.sessionId}
                        onClick={() => endSession(s.sessionId)}
                        fullWidth
                      >
                        {t('dashboard.endTask')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed sessions */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            {t('dashboard.completedTasks')}
          </h2>
          <div className="space-y-2">
            {completed.map((s) => (
              <Card key={s.sessionId} padding="sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: '#E5E7EB' }} />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-black text-sm">{s.personnelName}</span>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {getDepartmentLabel(s.department, lang)} · {s.colliCount} colli
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-400">
                      {formatTime(s.startedAt)} – {s.endedAt ? formatTime(s.endedAt) : '-'}
                    </div>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <span className="text-xs font-medium text-gray-700">
                        {s.actualMinutes !== null ? formatDuration(s.actualMinutes) : '-'}
                      </span>
                      {s.performanceDiff !== null && (
                        <PerformanceDiff diffMinutes={s.performanceDiff} />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <Card>
          <EmptyState
            title={t('dashboard.noCompletedTasks')}
            action={
              <Link href="/tasks/new">
                <Button>{t('dashboard.startTask')}</Button>
              </Link>
            }
          />
        </Card>
      )}
    </div>
  )
}

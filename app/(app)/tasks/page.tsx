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
import { apiFetch } from '@/lib/api'

const PAGE_SIZE = 20

interface SessionRow {
  sessionId: string
  taskId: string
  department: string
  colliCount: number
  expectedMinutes: number
  personnelName: string
  startedAt: string
  endedAt: string | null
  isPaused: boolean
  workDate: string
  actualMinutes: number | null
  performanceDiff: number | null
}

interface PersonnelEntry {
  sessionId: string
  personnelName: string
  endedAt: string | null
  isPaused: boolean
  actualMinutes: number | null
  performanceDiff: number | null
}

interface TaskGroup {
  taskId: string
  department: string
  colliCount: number
  expectedMinutes: number
  workDate: string
  startedAt: string
  endedAt: string | null
  isActive: boolean
  isPaused: boolean
  personnel: PersonnelEntry[]
  avgPerformanceDiff: number | null
}

function getTodayLocalDate(): string {
  const now = new Date()
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localTime.toISOString().slice(0, 10)
}

function shiftLocalDate(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`)
  d.setDate(d.getDate() + days)
  const localTime = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return localTime.toISOString().slice(0, 10)
}

function groupByTask(sessions: SessionRow[]): TaskGroup[] {
  const map = new Map<string, TaskGroup>()

  for (const s of sessions) {
    let group = map.get(s.taskId)
    if (!group) {
      group = {
        taskId: s.taskId,
        department: s.department,
        colliCount: s.colliCount,
        expectedMinutes: s.expectedMinutes,
        workDate: s.workDate,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        isActive: !s.endedAt,
        isPaused: false,
        personnel: [],
        avgPerformanceDiff: null,
      }
      map.set(s.taskId, group)
    } else {
      if (!s.endedAt) group.isActive = true
    }

    group.personnel.push({
      sessionId: s.sessionId,
      personnelName: s.personnelName,
      endedAt: s.endedAt,
      isPaused: s.isPaused,
      actualMinutes: s.actualMinutes !== null ? Number(s.actualMinutes) : null,
      performanceDiff: s.performanceDiff !== null ? Number(s.performanceDiff) : null,
    })
  }

  for (const group of map.values()) {
    group.isActive = group.personnel.some((p) => !p.endedAt)
    group.isPaused = group.isActive && group.personnel.filter((p) => !p.endedAt).every((p) => p.isPaused)
    if (!group.isActive) {
      const endTimes = group.personnel.map((p) => p.endedAt).filter(Boolean) as string[]
      group.endedAt = endTimes.sort().at(-1) ?? null
    } else {
      group.endedAt = null
    }

    const withDiff = group.personnel.filter((p) => p.performanceDiff !== null)
    if (withDiff.length > 0) {
      group.avgPerformanceDiff = withDiff.reduce((sum, p) => sum + p.performanceDiff!, 0) / withDiff.length
    }
  }

  return Array.from(map.values())
}

export default function TasksPage() {
  const { t, lang } = useLanguage()
  const [today] = useState(getTodayLocalDate)

  const [allSessions, setAllSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (p: number, replace: boolean) => {
    const params = new URLSearchParams()
    params.set('dateFrom', selectedDate)
    params.set('dateTo', selectedDate)
    params.set('page', String(p))
    params.set('pageSize', String(PAGE_SIZE))
    try {
      const res = await apiFetch(`/api/tasks?${params}`)
      if (res.ok) {
        const data = await res.json()
        const sessions: SessionRow[] = data.sessions ?? []
        setTotal(data.total ?? sessions.length)
        setPage(data.page ?? p)
        if (replace) {
          setAllSessions(sessions)
        } else {
          setAllSessions((prev) => [...prev, ...sessions])
        }
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [selectedDate])

  useEffect(() => {
    setLoading(true)
    setAllSessions([])
    setPage(1)
    load(1, true)
  }, [load])

  const doAction = async (taskId: string, action: 'end' | 'pause' | 'resume') => {
    setActionId(taskId + action)
    try {
      await apiFetch(`/api/tasks/${taskId}/${action}`, { method: 'POST', body: '{}' })
      await load(1, true)
    } finally {
      setActionId(null)
    }
  }

  const loadMore = () => {
    setLoadingMore(true)
    load(page + 1, false)
  }

  const taskGroups = groupByTask(allSessions)
  const hasMore = allSessions.length < total
  const canGoNext = selectedDate < today
  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
      <PageHeader
        title={t('tasks.title')}
        action={
          <Link href="/tasks/new">
            <Button size="md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {t('tasks.startNew')}
            </Button>
          </Link>
        }
      />

      {/* Day bar */}
      <Card padding="sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftLocalDate(prev, -1))}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-white hover:border-gray-300 transition-colors flex items-center justify-center flex-shrink-0"
            aria-label={lang === 'nl' ? 'Vorige dag' : 'Previous day'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 text-center min-w-0">
            <div className="text-xs font-medium text-gray-500">{lang === 'nl' ? 'Geselecteerde dag' : 'Selected day'}</div>
            <div className="text-sm font-semibold text-gray-900 truncate capitalize">{dateLabel}</div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate((prev) => shiftLocalDate(prev, 1))}
            disabled={!canGoNext}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-white hover:border-gray-300 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={lang === 'nl' ? 'Volgende dag' : 'Next day'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {selectedDate !== today && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(today)} className="flex-shrink-0">
              {lang === 'nl' ? 'Vandaag' : 'Today'}
            </Button>
          )}
        </div>
      </Card>

      {taskGroups.length === 0 ? (
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
        <>
          <div className="space-y-2">
            {taskGroups.map((group) => {
              const perfColor =
                group.avgPerformanceDiff === null || group.isActive ? undefined
                : group.avgPerformanceDiff <= 0 ? '#80BC17'
                : '#E40B17'

              const personnelNames = group.personnel.map((p) => p.personnelName).join(', ')

              return (
                <Card key={group.taskId} padding="none" className="overflow-hidden">
                  <div className="flex">
                    <div
                      className="w-1 flex-shrink-0 self-stretch"
                      style={{ backgroundColor: group.isActive ? '#80BC17' : (perfColor ?? '#D1D5DB') }}
                    />
                    <div className="flex-1 flex items-start justify-between gap-3 px-3 py-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-semibold text-black text-sm truncate max-w-[200px]">{personnelNames}</span>
                          {group.isActive ? (
                            group.isPaused
                              ? <Badge variant="orange">{lang === 'nl' ? 'Gepauzeerd' : 'Paused'}</Badge>
                              : <Badge variant="green">{t('tasks.active')}</Badge>
                          ) : (
                            <Badge variant="gray">{t('tasks.completed')}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mb-1.5">
                          {getDepartmentLabel(group.department, lang)} · {group.colliCount} {t('tasks.colli')}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                          <span>{formatDate(group.workDate)}</span>
                          <span className="tabular-nums">
                            {formatTime(group.startedAt)}{group.endedAt ? ` – ${formatTime(group.endedAt)}` : ''}
                          </span>
                          <span>{t('tasks.expected')}: {group.expectedMinutes}m</span>
                          {!group.isActive && group.personnel[0]?.actualMinutes !== null && (
                            <span>{t('tasks.actual')}: {formatDuration(
                              group.personnel.reduce((sum, p) => sum + (p.actualMinutes ?? 0), 0) / group.personnel.filter(p => p.actualMinutes !== null).length
                            )}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {group.avgPerformanceDiff !== null && !group.isActive && (
                          <PerformanceDiff diffMinutes={group.avgPerformanceDiff} />
                        )}
                        {group.isActive && (
                          <div className="flex gap-1.5">
                            {group.isPaused ? (
                              <Button
                                size="sm"
                                loading={actionId === group.taskId + 'resume'}
                                onClick={() => doAction(group.taskId, 'resume')}
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={actionId === group.taskId + 'pause'}
                                onClick={() => doAction(group.taskId, 'pause')}
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                </svg>
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              size="sm"
                              loading={actionId === group.taskId + 'end'}
                              onClick={() => doAction(group.taskId, 'end')}
                            >
                              {t('dashboard.endTask')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadMore}>
                {t('common.loadMore')} ({total - allSessions.length})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

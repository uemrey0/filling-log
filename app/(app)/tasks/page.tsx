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

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
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

  const doAction = async (taskId: string, action: 'end' | 'pause' | 'resume') => {
    setActionId(taskId + action)
    try {
      await fetch(`/api/tasks/${taskId}/${action}`, { method: 'POST', body: '{}' })
      await load()
    } finally {
      setActionId(null)
    }
  }

  const taskGroups = groupByTask(sessions)

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

      {/* Date filter */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('analytics.dateTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
            />
          </div>
          {(dateFrom || dateTo) && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="w-full sm:w-auto"
              >
                {t('analytics.reset')}
              </Button>
            </div>
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
      )}
    </div>
  )
}

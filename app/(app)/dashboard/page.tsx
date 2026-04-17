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
  isPaused: boolean
  pausedSince: string | null
  totalPausedMinutes: number
  workDate: string
  actualMinutes: number | null
  performanceDiff: number | null
}

interface PersonnelEntry {
  sessionId: string
  personnelId: string
  personnelName: string
  startedAt: string
  endedAt: string | null
  isPaused: boolean
  pausedSince: string | null
  totalPausedMinutes: number
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
  pausedSince: string | null
  totalPausedMinutes: number
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
        isPaused: s.isPaused,
        pausedSince: s.pausedSince,
        totalPausedMinutes: Number(s.totalPausedMinutes ?? 0),
        personnel: [],
        avgPerformanceDiff: null,
      }
      map.set(s.taskId, group)
    } else {
      if (!s.endedAt) group.isActive = true
      if (s.isPaused) {
        group.isPaused = true
        group.pausedSince = s.pausedSince
      }
      if (new Date(s.startedAt) < new Date(group.startedAt)) group.startedAt = s.startedAt
    }

    group.personnel.push({
      sessionId: s.sessionId,
      personnelId: s.personnelId,
      personnelName: s.personnelName,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      isPaused: s.isPaused,
      pausedSince: s.pausedSince,
      totalPausedMinutes: Number(s.totalPausedMinutes ?? 0),
      actualMinutes: s.actualMinutes !== null ? Number(s.actualMinutes) : null,
      performanceDiff: s.performanceDiff !== null ? Number(s.performanceDiff) : null,
    })
  }

  for (const group of map.values()) {
    group.isActive = group.personnel.some((p) => !p.endedAt)
    group.isPaused = group.isActive && group.personnel.filter((p) => !p.endedAt).every((p) => p.isPaused)
    group.totalPausedMinutes = group.personnel[0]?.totalPausedMinutes ?? 0

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

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) {
    return (
      <span className="font-mono tabular-nums">
        <span className="text-3xl font-bold text-black">--:--</span>
        <span className="text-lg font-semibold text-gray-300">:--</span>
      </span>
    )
  }

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  return (
    <span className="font-mono tabular-nums">
      <span className="text-3xl font-bold text-black">{hh}:{mm}</span>
      <span className="text-lg font-semibold" style={{ color: '#80BC17' }}>:{ss}</span>
    </span>
  )
}

function ActiveTaskProgress({
  startedAt,
  expectedMinutes,
  isPaused,
  pausedSince,
  totalPausedMinutes,
}: {
  startedAt: string
  expectedMinutes: number
  isPaused: boolean
  pausedSince: string | null
  totalPausedMinutes: number
}) {
  const [netElapsed, setNetElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const pausedMs = totalPausedMinutes * 60000

    if (isPaused && pausedSince) {
      const frozenAt = new Date(pausedSince).getTime()
      setNetElapsed(Math.max(0, frozenAt - start - pausedMs))
      return
    }

    const update = () => setNetElapsed(Math.max(0, Date.now() - start - pausedMs))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt, isPaused, pausedSince, totalPausedMinutes])

  const totalSec = Math.floor(netElapsed / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  const elapsedMin = netElapsed / 60000
  const progress = Math.min((elapsedMin / expectedMinutes) * 100, 100)
  const isOverdue = elapsedMin > expectedMinutes
  const isNearEnd = progress >= 80

  const timerColor = isPaused ? '#9CA3AF'
    : isOverdue ? '#E40B17'
    : isNearEnd ? '#F97316'
    : '#1C7745'
  const barColor = isPaused ? '#D1D5DB'
    : isOverdue ? '#E40B17'
    : isNearEnd ? '#F97316'
    : '#80BC17'

  const hStr = h > 0 ? `${h}u ` : ''
  const mStr = String(m).padStart(h > 0 ? 2 : 1, '0')
  const sStr = String(s).padStart(2, '0')

  return (
    <div className="space-y-2">
      {/* Prominent timer */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono font-bold text-3xl tabular-nums leading-none" style={{ color: timerColor }}>
          {hStr}{mStr}:{sStr}
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          / {expectedMinutes}m
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${progress}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{Math.round(progress)}%</span>
        {isOverdue && <span style={{ color: '#E40B17' }} className="font-medium">+{Math.floor(elapsedMin - expectedMinutes)}m over</span>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { t, lang } = useLanguage()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?today=true')
      if (res.ok) {
        setSessions(await res.json())
        setLoadError(null)
      } else {
        const data = await res.json().catch(() => ({}))
        setLoadError(data.error ?? `API error ${res.status}`)
      }
    } catch (err) {
      setLoadError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

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
  const active = taskGroups.filter((g) => g.isActive)
  const completed = taskGroups.filter((g) => !g.isActive)

  const allCompletedDiffs = completed
    .flatMap((g) => g.personnel.filter((p) => p.performanceDiff !== null).map((p) => p.performanceDiff!))

  const avgDiff = allCompletedDiffs.length > 0
    ? allCompletedDiffs.reduce((a, b) => a + b, 0) / allCompletedDiffs.length
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

  if (loadError) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm font-medium border" style={{ backgroundColor: '#FEF2F2', color: '#E40B17', borderColor: '#FCA5A5' }}>
        {lang === 'nl' ? 'Fout bij laden' : 'Error loading'}: {loadError}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black leading-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{todayLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <LiveClock />
          <Link href="/tasks/new">
            <Button size="md" className="whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {t('dashboard.startTask')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary strip */}
      {taskGroups.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card padding="sm" className="text-center">
            <div className="mx-auto mb-2 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-black leading-none">{completed.length}</div>
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">{t('dashboard.tasksCompleted')}</div>
          </Card>

          <Card padding="sm" className="text-center" style={{ borderColor: '#80BC17' + '50' }}>
            <div className="mx-auto mb-2 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#80BC17' + '20' }}>
              <svg className="w-4 h-4" style={{ color: '#80BC17' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-2xl font-bold leading-none" style={{ color: '#80BC17' }}>{active.length}</div>
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">{t('dashboard.activeTasks')}</div>
          </Card>

          <Card padding="sm" className="text-center">
            <div className="mx-auto mb-2 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            {avgDiff !== null ? (
              <div className="flex justify-center items-center" style={{ minHeight: '2rem' }}>
                <PerformanceDiff diffMinutes={avgDiff} />
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-300 leading-none">–</div>
            )}
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">{t('dashboard.averagePerformance')}</div>
          </Card>
        </div>
      )}

      {/* Active tasks */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {t('dashboard.activeTasks')}
          </h2>
          {active.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#80BC17' }}>
              {active.length}
            </span>
          )}
        </div>

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
          <div className="space-y-2">
            {active.map((group) => (
              <Card key={group.taskId} padding="none" className="overflow-hidden">
                <div
                  className="h-1"
                  style={{ backgroundColor: group.isPaused ? '#D1D5DB' : '#80BC17' }}
                />
                <div className="px-4 pt-3 pb-4 space-y-3">
                  {/* Row 1: Names + status badge */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-bold text-gray-900 text-base leading-snug flex-1 min-w-0">
                      {group.personnel.map((p) => p.personnelName).join(' · ')}
                    </span>
                    {group.isPaused ? (
                      <Badge variant="orange" className="flex-shrink-0 mt-0.5">
                        {lang === 'nl' ? 'Gepauzeerd' : 'Paused'}
                      </Badge>
                    ) : (
                      <Badge variant="green" className="flex-shrink-0 mt-0.5">{t('tasks.active')}</Badge>
                    )}
                  </div>

                  {/* Row 2: Task details */}
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="font-medium">{getDepartmentLabel(group.department, lang)}</span>
                    <span className="text-gray-300">·</span>
                    <span>{group.colliCount} {t('tasks.colli')}</span>
                    <span className="text-gray-300">·</span>
                    <span>{group.expectedMinutes}m {lang === 'nl' ? 'verwacht' : 'expected'}</span>
                  </div>

                  {/* Row 3: Timer + progress */}
                  <ActiveTaskProgress
                    startedAt={group.startedAt}
                    expectedMinutes={group.expectedMinutes}
                    isPaused={group.isPaused}
                    pausedSince={group.pausedSince}
                    totalPausedMinutes={group.totalPausedMinutes}
                  />

                  {/* Row 4: Footer — start time + actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-400 flex-1 tabular-nums">
                      {t('tasks.started')}: {formatTime(group.startedAt)}
                    </span>
                    {group.isPaused ? (
                      <Button
                        size="sm"
                        loading={actionId === group.taskId + 'resume'}
                        onClick={() => doAction(group.taskId, 'resume')}
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        {lang === 'nl' ? 'Hervatten' : 'Resume'}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={actionId === group.taskId + 'pause'}
                        onClick={() => doAction(group.taskId, 'pause')}
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                        {lang === 'nl' ? 'Pauzeren' : 'Pause'}
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
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed tasks */}
      {completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              {t('dashboard.completedTasks')}
            </h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
              {completed.length}
            </span>
          </div>
          <div className="space-y-2">
            {completed.map((group) => {
              const perfColor =
                group.avgPerformanceDiff === null ? '#D1D5DB'
                : group.avgPerformanceDiff <= 0 ? '#80BC17'
                : '#E40B17'

              const personnelNames = group.personnel.map((p) => p.personnelName).join(', ')
              const completedPersonnel = group.personnel.filter((p) => p.actualMinutes !== null)
              const avgActual = completedPersonnel.length > 0
                ? completedPersonnel.reduce((sum, p) => sum + p.actualMinutes!, 0) / completedPersonnel.length
                : null

              return (
                <Card key={group.taskId} padding="none" className="overflow-hidden">
                  <div className="flex">
                    <div className="w-1.5 flex-shrink-0 self-stretch" style={{ backgroundColor: perfColor }} />
                    <div className="flex-1 flex items-center justify-between gap-3 px-3 py-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm leading-snug truncate">{personnelNames}</div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {getDepartmentLabel(group.department, lang)} · {group.colliCount} {t('tasks.colli')}
                        </div>
                        <div className="text-xs text-gray-400 tabular-nums mt-1">
                          {formatTime(group.startedAt)} – {group.endedAt ? formatTime(group.endedAt) : '–'}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        {avgActual !== null && (
                          <span className="text-sm font-bold text-gray-800 tabular-nums">
                            {formatDuration(avgActual)}
                          </span>
                        )}
                        {group.avgPerformanceDiff !== null && (
                          <PerformanceDiff diffMinutes={group.avgPerformanceDiff} />
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {taskGroups.length === 0 && (
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

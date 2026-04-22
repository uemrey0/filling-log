'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { TaskSummaryCard, TaskSummaryCardSkeleton } from '@/components/ui/TaskSummaryCard'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDuration, calcExpectedMinutesFromSessionStarts } from '@/lib/business'
import { apiFetch } from '@/lib/api'

const PAGE_SIZE = 20

interface SessionRow {
  sessionId: string
  taskId: string
  department: string
  discountContainer: boolean
  colliCount: number
  expectedMinutes: number
  expectedSessionMinutes: number
  taskNotes: string | null
  personnelName: string
  startedAt: string
  endedAt: string | null
  isPaused: boolean
  totalPausedMinutes: number
  workDate: string
  actualMinutes: number | null
  performanceDiff: number | null
}

interface PersonnelEntry {
  sessionId: string
  personnelName: string
  startedAt: string
  endedAt: string | null
  expectedSessionMinutes: number
  isPaused: boolean
  totalPausedMinutes: number
  actualMinutes: number | null
  performanceDiff: number | null
}

interface TaskGroup {
  taskId: string
  department: string
  discountContainer: boolean
  colliCount: number
  expectedMinutes: number
  workDate: string
  startedAt: string
  endedAt: string | null
  isActive: boolean
  isPaused: boolean
  totalPausedMinutes: number
  hasNotes: boolean
  personnel: PersonnelEntry[]
  avgPerformanceDiff: number | null
  avgActualMinutes: number | null
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
        discountContainer: s.discountContainer,
        colliCount: s.colliCount,
        expectedMinutes: s.expectedMinutes,
        workDate: s.workDate,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        isActive: !s.endedAt,
        isPaused: false,
        totalPausedMinutes: Number(s.totalPausedMinutes ?? 0),
        hasNotes: !!(s.taskNotes && s.taskNotes.trim().length > 0),
        personnel: [],
        avgPerformanceDiff: null,
        avgActualMinutes: null,
      }
      map.set(s.taskId, group)
    } else {
      if (!s.endedAt) group.isActive = true
      if (new Date(s.startedAt) < new Date(group.startedAt)) group.startedAt = s.startedAt
    }

    group.personnel.push({
      sessionId: s.sessionId,
      personnelName: s.personnelName,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      expectedSessionMinutes: Number(s.expectedSessionMinutes ?? s.expectedMinutes),
      isPaused: s.isPaused,
      totalPausedMinutes: Number(s.totalPausedMinutes ?? 0),
      actualMinutes: s.actualMinutes !== null ? Number(s.actualMinutes) : null,
      performanceDiff: s.performanceDiff !== null ? Number(s.performanceDiff) : null,
    })
  }

  for (const group of map.values()) {
    group.isActive = group.personnel.some((p) => !p.endedAt)
    group.isPaused = group.isActive && group.personnel.filter((p) => !p.endedAt).every((p) => p.isPaused)
    group.totalPausedMinutes = Math.max(...group.personnel.map((p) => p.totalPausedMinutes), 0)
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

    const withActual = group.personnel.filter((p) => p.actualMinutes !== null)
    if (withActual.length > 0) {
      group.avgActualMinutes = withActual.reduce((sum, p) => sum + p.actualMinutes!, 0) / withActual.length
    }
  }

  return Array.from(map.values())
}

function getPlannedEndTsForGroup(group: TaskGroup): number | null {
  const startTimes = group.personnel.map((p) => p.startedAt)
  const anchorTs = Math.min(...startTimes.map((value) => new Date(value).getTime()).filter((ts) => Number.isFinite(ts)))
  if (!Number.isFinite(anchorTs)) return null

  const projectedExpectedMinutes = calcExpectedMinutesFromSessionStarts(
    group.colliCount,
    startTimes,
    group.discountContainer,
  )
  return anchorTs + (projectedExpectedMinutes + group.totalPausedMinutes) * 60000
}

export default function TasksPage() {
  const { t, lang } = useLanguage()
  const [today] = useState(getTodayLocalDate)

  const [allSessions, setAllSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showDiscountInfo, setShowDiscountInfo] = useState(false)

  const applySelectedDate = (nextDate: string) => {
    if (nextDate === selectedDate) return
    setLoading(true)
    setLoadingMore(false)
    setAllSessions([])
    setPage(1)
    setTotal(0)
    setSelectedDate(nextDate)
  }

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
    load(1, true)
  }, [load])

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
            onClick={() => applySelectedDate(shiftLocalDate(selectedDate, -1))}
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
            onClick={() => applySelectedDate(shiftLocalDate(selectedDate, 1))}
            disabled={!canGoNext}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-white hover:border-gray-300 transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={lang === 'nl' ? 'Volgende dag' : 'Next day'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {selectedDate !== today && (
            <Button variant="ghost" size="sm" onClick={() => applySelectedDate(today)} className="flex-shrink-0">
              {lang === 'nl' ? 'Vandaag' : 'Today'}
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          <TaskSummaryCardSkeleton />
          <TaskSummaryCardSkeleton />
          <TaskSummaryCardSkeleton />
        </div>
      ) : taskGroups.length === 0 ? (
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

              const departmentLabel = getDepartmentLabel(group.department, lang)
              const personnelNames = group.personnel.map((p) => p.personnelName)
              const personnelSummary = personnelNames.length > 2
                ? `${personnelNames.slice(0, 2).join(', ')} +${personnelNames.length - 2}`
                : personnelNames.join(', ')
              const totalDuration = group.avgActualMinutes
              const plannedEndTs = getPlannedEndTsForGroup(group)
              const plannedEndTime = !group.isActive && group.endedAt
                ? (plannedEndTs ? formatTime(new Date(plannedEndTs)) : undefined)
                : undefined

              return (
                <Link key={group.taskId} href={`/tasks/${group.taskId}`} className="block">
                  <TaskSummaryCard
                    className="hover:border-gray-300 transition-colors"
                    accentColor={group.isActive ? '#80BC17' : (perfColor ?? '#D1D5DB')}
                    title={personnelSummary}
                    subtitle={`${departmentLabel} · ${group.colliCount} ${t('tasks.colli')}`}
                    metaBadgeLabel={group.discountContainer ? t('tasks.discountContainerBadge') : undefined}
                    onMetaBadgeClick={group.discountContainer ? () => setShowDiscountInfo(true) : undefined}
                    startTime={formatTime(group.startedAt)}
                    endTime={group.endedAt ? formatTime(group.endedAt) : null}
                    plannedEndTime={plannedEndTime}
                    plannedLabel={t('tasks.planned')}
                    statusLabel={group.isActive ? (group.isPaused ? (lang === 'nl' ? 'Gepauzeerd' : 'Paused') : t('tasks.active')) : undefined}
                    statusTone={group.isPaused ? 'paused' : 'active'}
                    duration={!group.isActive && totalDuration !== null ? formatDuration(totalDuration) : null}
                    diffMinutes={!group.isActive ? group.avgPerformanceDiff : null}
                    hasNotes={group.hasNotes}
                    notesLabel={t('tasks.notes')}
                  />
                </Link>
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

      <ModalOrSheet open={showDiscountInfo} onClose={() => setShowDiscountInfo(false)}>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.discountContainerTitle')}</h2>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerDescription')}</p>
        </div>
      </ModalOrSheet>
    </div>
  )
}

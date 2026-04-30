'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { TaskSummaryCard, TaskSummaryCardSkeleton } from '@/components/ui/TaskSummaryCard'
import { TaskEditModal } from '@/components/ui/TaskEditModal'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { EndTaskModal, type EndTaskConfirmData } from '@/components/ui/EndTaskModal'
import { RatingModal, type RatingTarget, type RatingData } from '@/components/ui/RatingModal'
import { Skeleton } from '@/components/ui/Skeleton'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDuration, calcExpectedMinutesFromSessionStarts } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

interface SessionRow {
  sessionId: string
  taskId: string
  department: string
  discountContainer: boolean
  colliCount: number
  expectedMinutes: number
  expectedSessionMinutes: number
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
  expectedSessionMinutes: number
  isPaused: boolean
  pausedSince: string | null
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
  taskNotes: string | null
  hasNotes: boolean
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

interface EditableTaskForModal {
  id: string
  department: string
  discountContainer: boolean
  colliCount: number
  notes: string | null
  sessions: Array<{
    id: string
    personnelId: string
    personnelName: string
    startedAt: string
    endedAt: string | null
  }>
}

interface ApiErrorPayload {
  error?: string
  code?: string
}

interface AnalyticsOverviewPayload {
  overview?: {
    avgDiffMinutes?: number | null
  }
}

async function parseApiErrorPayload(response: Response): Promise<ApiErrorPayload> {
  return response.json().catch(() => ({})) as Promise<ApiErrorPayload>
}

function getDashboardErrorMessage(
  lang: 'nl' | 'en',
  code: string | undefined,
  fallback: string,
): string {
  if (code === 'TASK_NOT_FOUND') {
    return lang === 'nl' ? 'Deze taak bestaat niet meer.' : 'This task no longer exists.'
  }
  if (code === 'TASK_ALREADY_ENDED') {
    return lang === 'nl' ? 'Deze taak is al beëindigd.' : 'This task is already ended.'
  }
  if (code === 'TASK_ALREADY_PAUSED') {
    return lang === 'nl' ? 'Deze taak is al gepauzeerd.' : 'This task is already paused.'
  }
  if (code === 'TASK_NOT_PAUSED') {
    return lang === 'nl' ? 'Deze taak is al hervat.' : 'This task is already resumed.'
  }
  if (code === 'TASK_COMPLETED_EDIT_FORBIDDEN') {
    return lang === 'nl'
      ? 'Een afgeronde taak kan niet meer aangepast worden.'
      : 'A completed task can no longer be edited.'
  }
  if (code === 'INVALID_INPUT') {
    return lang === 'nl' ? 'Ongeldige invoer.' : 'Invalid input.'
  }
  if (code === 'INVALID_ENDED_AT') {
    return lang === 'nl' ? 'Ongeldige eindtijd.' : 'Invalid end time.'
  }
  return fallback
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
        taskNotes: s.taskNotes,
        hasNotes: !!(s.taskNotes && s.taskNotes.trim().length > 0),
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
      if (s.taskNotes && s.taskNotes.trim().length > 0) group.hasNotes = true
      if (new Date(s.startedAt) < new Date(group.startedAt)) group.startedAt = s.startedAt
    }

    group.personnel.push({
      sessionId: s.sessionId,
      personnelId: s.personnelId,
      personnelName: s.personnelName,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      expectedSessionMinutes: Number(s.expectedSessionMinutes ?? s.expectedMinutes),
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
    const pauseSource = group.isActive
      ? group.personnel.filter((p) => !p.endedAt)
      : group.personnel
    group.totalPausedMinutes = Math.max(...pauseSource.map((p) => p.totalPausedMinutes), 0)

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

function getProjectedExpectedMinutesForGroup(group: TaskGroup): number {
  const activeSessions = group.personnel.filter((p) => !p.endedAt)
  const source = activeSessions.length > 0 ? activeSessions : group.personnel
  return calcExpectedMinutesFromSessionStarts(
    group.colliCount,
    source.map((p) => p.startedAt),
    group.discountContainer,
  )
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
  personnel,
  colliCount,
  discountContainer,
  isPaused,
}: {
  personnel: PersonnelEntry[]
  colliCount: number
  discountContainer: boolean
  isPaused: boolean
}) {
  const [netElapsed, setNetElapsed] = useState(0)
  const [expectedMinutes, setExpectedMinutes] = useState(0)
  const [predictedEndTs, setPredictedEndTs] = useState<number | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  useEffect(() => {
    const activeSessions = personnel.filter((p) => !p.endedAt)
    if (activeSessions.length === 0) {
      setNetElapsed(0)
      setExpectedMinutes(0)
      setPredictedEndTs(null)
      return
    }

    const startTs = Math.min(
      ...activeSessions
        .map((p) => new Date(p.startedAt).getTime())
        .filter((ts) => Number.isFinite(ts)),
    )
    if (!Number.isFinite(startTs)) {
      setNetElapsed(0)
      setExpectedMinutes(0)
      setPredictedEndTs(null)
      return
    }

    const projectedExpected = calcExpectedMinutesFromSessionStarts(
      colliCount,
      activeSessions.map((p) => p.startedAt),
      discountContainer,
    )
    const pausedMinutes = Math.max(...activeSessions.map((p) => Number(p.totalPausedMinutes ?? 0)), 0)
    const pausedMs = pausedMinutes * 60000
    const pausedSinceTs = isPaused
      ? activeSessions
        .map((p) => (p.pausedSince ? new Date(p.pausedSince).getTime() : null))
        .filter((ts): ts is number => ts !== null && Number.isFinite(ts))
        .sort((a, b) => a - b)[0] ?? null
      : null

    const update = () => {
      const now = Date.now()
      setNowTs(now)

      const frozenAt = isPaused && pausedSinceTs ? pausedSinceTs : now
      const elapsedMs = Math.max(0, frozenAt - startTs - pausedMs)
      const livePausedMs = isPaused && pausedSinceTs ? Math.max(0, now - pausedSinceTs) : 0
      const projectedEnd = startTs + projectedExpected * 60000 + pausedMs + livePausedMs

      setNetElapsed(elapsedMs)
      setExpectedMinutes(projectedExpected)
      setPredictedEndTs(projectedEnd)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [personnel, colliCount, discountContainer, isPaused])

  const totalSec = Math.floor(netElapsed / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  const elapsedMin = netElapsed / 60000
  const expectedMin = expectedMinutes
  const remainingEstimatedMinutes = predictedEndTs === null
    ? 0
    : Math.max(0, Math.ceil((predictedEndTs - nowTs) / 60000))
  const progress = expectedMin > 0
    ? Math.min((elapsedMin / expectedMin) * 100, 100)
    : 100
  const isOverdue = predictedEndTs !== null && nowTs > predictedEndTs
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
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono font-bold text-3xl tabular-nums leading-none" style={{ color: timerColor }}>
          {hStr}{mStr}:{sStr}
        </span>
        <span className="text-xs text-gray-400 tabular-nums">
          {predictedEndTs ? formatTime(new Date(predictedEndTs)) : '--:--'} / {remainingEstimatedMinutes}m
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${progress}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{Math.round(progress)}%</span>
        {isOverdue && <span style={{ color: '#E40B17' }} className="font-medium">+{Math.floor(elapsedMin - expectedMin)}m over</span>}
      </div>
    </div>
  )
}

function getTodayLocalDate(): string {
  const now = new Date()
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localTime.toISOString().slice(0, 10)
}

const PAGE_SIZE = 10

export default function DashboardPage() {
  const { t, lang } = useLanguage()
  const [activeSessions, setActiveSessions] = useState<SessionRow[]>([])
  const [completedSessions, setCompletedSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [completedPage, setCompletedPage] = useState(1)
  const [completedTotal, setCompletedTotal] = useState(0)
  const [totalActive, setTotalActive] = useState(0)
  const [avgDiff, setAvgDiff] = useState<number | null>(null)
  const [statusNowTs, setStatusNowTs] = useState(() => Date.now())
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState<EditableTaskForModal | null>(null)
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null)
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notesTask, setNotesTask] = useState<TaskGroup | null>(null)
  const [showDiscountInfo, setShowDiscountInfo] = useState(false)
  const [endingTask, setEndingTask] = useState<TaskGroup | null>(null)
  const [endingSaving, setEndingSaving] = useState(false)
  const [ratingQueue, setRatingQueue] = useState<RatingTarget[]>([])
  const [ratingSaving, setRatingSaving] = useState(false)

  const load = useCallback(async ({ showToastOnError = false }: { showToastOnError?: boolean } = {}) => {
    try {
      const today = getTodayLocalDate()
      const activeParams = new URLSearchParams()
      activeParams.set('today', 'true')
      activeParams.set('todayDate', today)
      activeParams.set('active', 'true')
      activeParams.set('paginate', 'false')

      const completedParams = new URLSearchParams()
      completedParams.set('today', 'true')
      completedParams.set('todayDate', today)
      completedParams.set('completed', 'true')
      completedParams.set('page', '1')
      completedParams.set('pageSize', String(PAGE_SIZE))

      const analyticsParams = new URLSearchParams()
      analyticsParams.set('dateFrom', today)
      analyticsParams.set('dateTo', today)

      const [activeRes, completedRes, analyticsRes] = await Promise.all([
        apiFetch(`/api/tasks?${activeParams}`),
        apiFetch(`/api/tasks?${completedParams}`),
        apiFetch(`/api/analytics?${analyticsParams}`),
      ])

      if (activeRes.ok && completedRes.ok) {
        const [activeData, completedData, analyticsData] = await Promise.all([
          activeRes.json(),
          completedRes.json(),
          analyticsRes.ok
            ? analyticsRes.json() as Promise<AnalyticsOverviewPayload>
            : Promise.resolve(null),
        ])
        setActiveSessions(activeData.sessions ?? [])
        setCompletedSessions(completedData.sessions ?? [])
        setTotalActive(Number(activeData.totalActive ?? activeData.total ?? 0))
        setCompletedTotal(Number(completedData.total ?? 0))
        setCompletedPage(Number(completedData.page ?? 1))
        setAvgDiff(
          analyticsData?.overview?.avgDiffMinutes !== undefined && analyticsData?.overview?.avgDiffMinutes !== null
            ? Number(analyticsData.overview.avgDiffMinutes)
            : null,
        )
        setLastUpdatedAt(new Date())
        return true
      }

      const failedRes = activeRes.ok ? completedRes : activeRes
      const payload = await parseApiErrorPayload(failedRes)
      if (showToastOnError) {
        const fallback = lang === 'nl' ? 'Taken laden mislukt.' : 'Failed to load tasks.'
        toast.error(getDashboardErrorMessage(lang, payload.code, payload.error ?? fallback))
      }
      return false
    } catch (err) {
      if (showToastOnError) {
        const fallback = lang === 'nl' ? 'Taken laden mislukt.' : 'Failed to load tasks.'
        toast.error(getDashboardErrorMessage(lang, undefined, String(err) || fallback))
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [lang])

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const today = getTodayLocalDate()
      const params = new URLSearchParams()
      params.set('today', 'true')
      params.set('todayDate', today)
      params.set('completed', 'true')
      params.set('page', String(completedPage + 1))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await apiFetch(`/api/tasks?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCompletedSessions((prev) => [...prev, ...(data.sessions ?? [])])
        setCompletedPage(Number(data.page ?? completedPage + 1))
      }
    } finally {
      setLoadingMore(false)
    }
  }, [completedPage, loadingMore])

  useEffect(() => {
    void load({ showToastOnError: true })
  }, [load])

  useEffect(() => {
    const id = setInterval(() => setStatusNowTs(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  const manualRefresh = async () => {
    setRefreshing(true)
    try {
      await load({ showToastOnError: true })
    } finally {
      setRefreshing(false)
    }
  }

  const doAction = async (taskId: string, action: 'end' | 'pause' | 'resume') => {
    setActionId(taskId + action)
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/${action}`, { method: 'POST', body: '{}' })
      if (!res.ok) {
        const payload = await parseApiErrorPayload(res)
        const fallback = lang === 'nl'
          ? 'Actie kon niet worden uitgevoerd.'
          : 'Action could not be completed.'
        toast.error(getDashboardErrorMessage(lang, payload.code, payload.error ?? fallback))
        await load({ showToastOnError: false })
        return
      }
      await load({ showToastOnError: false })
    } catch {
      const fallback = lang === 'nl' ? 'Actie kon niet worden uitgevoerd.' : 'Action could not be completed.'
      toast.error(getDashboardErrorMessage(lang, undefined, fallback))
    } finally {
      setActionId(null)
    }
  }

  const confirmEndTask = async (data: EndTaskConfirmData) => {
    if (!endingTask) return
    setEndingSaving(true)
    try {
      const res = await apiFetch(`/api/tasks/${endingTask.taskId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const payload = await parseApiErrorPayload(res)
        const fallback = lang === 'nl'
          ? 'Actie kon niet worden uitgevoerd.'
          : 'Action could not be completed.'
        toast.error(getDashboardErrorMessage(lang, payload.code, payload.error ?? fallback))
        await load({ showToastOnError: false })
        return
      }

      const continuingIds = new Set(data.continuingPersonnelIds ?? [])
      const taskId = endingTask.taskId
      const toRate: RatingTarget[] = endingTask.personnel
        .filter((p) => !continuingIds.has(p.personnelId))
        .map((p) => ({ personnelId: p.personnelId, personnelName: p.personnelName, taskId }))

      setEndingTask(null)
      await load({ showToastOnError: false })

      if (toRate.length > 0) setRatingQueue(toRate)
    } catch {
      const fallback = lang === 'nl' ? 'Actie kon niet worden uitgevoerd.' : 'Action could not be completed.'
      toast.error(getDashboardErrorMessage(lang, undefined, fallback))
    } finally {
      setEndingSaving(false)
    }
  }

  const submitRating = async (data: RatingData) => {
    setRatingSaving(true)
    try {
      await apiFetch(`/api/personnel/${data.personnelId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: data.taskId,
          workEthicScore: data.workEthicScore,
          qualityScore: data.qualityScore,
          teamworkScore: data.teamworkScore,
          comment: data.comment || undefined,
        }),
      })
    } finally {
      setRatingSaving(false)
      setRatingQueue((prev) => prev.slice(1))
    }
  }

  const skipRating = () => setRatingQueue((prev) => prev.slice(1))
  const skipAllRatings = () => setRatingQueue([])

  const openEdit = async (taskId: string) => {
    setEditLoadingId(taskId)
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`)
      if (!res.ok) {
        const payload = await parseApiErrorPayload(res)
        const fallback = lang === 'nl' ? 'Taak laden mislukt.' : 'Failed to load task.'
        toast.error(getDashboardErrorMessage(lang, payload.code, payload.error ?? fallback))
        return
      }
      const raw = await res.json() as EditableTaskForModal
      setEditTask({
        id: raw.id,
        department: raw.department,
        discountContainer: raw.discountContainer,
        colliCount: raw.colliCount,
        notes: raw.notes ?? null,
        sessions: raw.sessions ?? [],
      })
    } catch {
      const fallback = lang === 'nl' ? 'Taak laden mislukt.' : 'Failed to load task.'
      toast.error(getDashboardErrorMessage(lang, undefined, fallback))
    } finally {
      setEditLoadingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTaskId) return
    setDeletingId(deleteTaskId)
    setDeleteTaskId(null)
    try {
      const res = await apiFetch(`/api/tasks/${deleteTaskId}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = await parseApiErrorPayload(res)
        const fallback = lang === 'nl' ? 'Verwijderen mislukt.' : 'Delete failed.'
        toast.error(getDashboardErrorMessage(lang, payload.code, payload.error ?? fallback))
        await load({ showToastOnError: false })
        return
      }
      await load({ showToastOnError: false })
    } catch {
      const fallback = lang === 'nl' ? 'Verwijderen mislukt.' : 'Delete failed.'
      toast.error(getDashboardErrorMessage(lang, undefined, fallback))
    } finally {
      setDeletingId(null)
    }
  }

  const active = groupByTask(activeSessions)
  const completed = groupByTask(completedSessions)
  const hasAnyTasks = active.length > 0 || completed.length > 0
  const hasMoreCompleted = completed.length < completedTotal

  const todayLabel = new Date().toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const lastUpdatedLabel = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    : t('dashboard.notUpdatedYet')
  const lastUpdatedAgeMs = lastUpdatedAt ? Math.max(0, statusNowTs - lastUpdatedAt.getTime()) : null
  const lastUpdatedColor = !lastUpdatedAt
    ? '#9CA3AF'
    : lastUpdatedAgeMs !== null && lastUpdatedAgeMs > 10 * 60 * 1000
      ? '#E40B17'
      : lastUpdatedAgeMs !== null && lastUpdatedAgeMs > 3 * 60 * 1000
        ? '#F97316'
        : '#1C7745'

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 md:gap-6">
        <div>
          <h1 className="text-2xl font-bold text-black leading-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{todayLabel}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums" style={{ color: lastUpdatedColor }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lastUpdatedColor }} />
              {t('dashboard.lastUpdated')}: {lastUpdatedLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={refreshing}
              onClick={manualRefresh}
              aria-label={t('dashboard.refresh')}
              title={t('dashboard.refresh')}
              className="!px-2"
            >
              {!refreshing && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 9a8 8 0 00-14-3M4 15a8 8 0 0014 3" />
                </svg>
              )}
            </Button>
          </div>
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
      {loading ? (
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`dashboard-summary-skeleton-${idx}`} padding="sm" className="text-center space-y-2">
              <Skeleton className="h-8 w-8 rounded-full mx-auto" />
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-24 mx-auto" />
            </Card>
          ))}
        </div>
      ) : hasAnyTasks && (
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Card padding="sm" className="text-center">
            <div className="mx-auto mb-2 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-black leading-none">{completedTotal}</div>
            <div className="text-[11px] text-gray-500 mt-1 leading-tight">{t('dashboard.tasksCompleted')}</div>
          </Card>

          <Card padding="sm" className="text-center" style={{ borderColor: '#80BC17' + '50' }}>
            <div className="mx-auto mb-2 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#80BC17' + '20' }}>
              <svg className="w-4 h-4" style={{ color: '#80BC17' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="text-2xl font-bold leading-none" style={{ color: '#80BC17' }}>{totalActive}</div>
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

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <Card key={`dashboard-active-skeleton-${idx}`} padding="none" className="overflow-hidden">
                <div className="h-1 bg-gray-200" />
                <div className="px-4 pt-3 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2 w-full">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex gap-1.5">
                      <Skeleton className="h-7 w-7 rounded-lg" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-10 w-full" />
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <Skeleton className="h-3 w-40 flex-1" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : active.length === 0 ? (
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
                  {/* Row 1: Names + status badge + action buttons */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-gray-900 text-base leading-snug">
                        {group.personnel.map((p) => p.personnelName).join(' · ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {group.discountContainer && (
                        <button
                          type="button"
                          onClick={() => setShowDiscountInfo(true)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[11px] font-black text-red-600 ring-1 ring-red-200"
                          aria-label={t('tasks.discountContainerBadge')}
                          title={t('tasks.discountContainerBadge')}
                        >
                          %
                        </button>
                      )}
                      {group.isPaused ? (
                        <Badge variant="orange">{lang === 'nl' ? 'Gepauzeerd' : 'Paused'}</Badge>
                      ) : (
                        <Badge variant="green">{t('tasks.active')}</Badge>
                      )}
                      {group.hasNotes && (
                        <button
                          onClick={() => setNotesTask(group)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors"
                          title={t('tasks.notes')}
                          aria-label={t('tasks.notes')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                          </svg>
                        </button>
                      )}
                      {/* Edit button */}
                      <button
                        onClick={() => void openEdit(group.taskId)}
                        disabled={editLoadingId === group.taskId}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title={t('tasks.editTask')}
                      >
                        {editLoadingId === group.taskId ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        )}
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => setDeleteTaskId(group.taskId)}
                        disabled={deletingId === group.taskId}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title={t('tasks.deleteTask')}
                      >
                        {deletingId === group.taskId ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Task details */}
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="font-medium">{getDepartmentLabel(group.department, lang)}</span>
                    <span className="text-gray-300">·</span>
                    <span>{group.colliCount} {t('tasks.colli')}</span>
                    <span className="text-gray-300">·</span>
                    <span>
                      {getProjectedExpectedMinutesForGroup(group)}m {lang === 'nl' ? 'verwacht' : 'expected'}
                    </span>
                  </div>

                  {/* Row 3: Timer + progress */}
                  <ActiveTaskProgress
                    personnel={group.personnel}
                    colliCount={group.colliCount}
                    discountContainer={group.discountContainer}
                    isPaused={group.isPaused}
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
                      onClick={() => setEndingTask(group)}
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
      {(loading || completed.length > 0 || hasMoreCompleted) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              {t('dashboard.completedTasks')}
            </h2>
            {!loading && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
                {completedTotal}
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              <TaskSummaryCardSkeleton />
              <TaskSummaryCardSkeleton />
              <TaskSummaryCardSkeleton />
            </div>
          ) : (
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
              const plannedEndTs = getPlannedEndTsForGroup(group)
              const plannedEndTime = group.endedAt
                ? (plannedEndTs ? formatTime(new Date(plannedEndTs)) : undefined)
                : undefined

              return (
                <Link key={group.taskId} href={`/tasks/${group.taskId}`} className="block">
                  <TaskSummaryCard
                    className="hover:border-gray-300 transition-colors"
                    accentColor={perfColor}
                    title={personnelNames}
                    subtitle={`${getDepartmentLabel(group.department, lang)} · ${group.colliCount} ${t('tasks.colli')}`}
                    metaBadgeLabel={group.discountContainer ? t('tasks.discountContainerBadge') : undefined}
                    onMetaBadgeClick={group.discountContainer ? () => setShowDiscountInfo(true) : undefined}
                    startTime={formatTime(group.startedAt)}
                    endTime={group.endedAt ? formatTime(group.endedAt) : null}
                    plannedEndTime={plannedEndTime}
                    plannedLabel={t('tasks.planned')}
                    duration={avgActual !== null ? formatDuration(avgActual) : null}
                    diffMinutes={group.avgPerformanceDiff}
                    hasNotes={group.hasNotes}
                    notesLabel={t('tasks.notes')}
                  />
                </Link>
              )
            })}
            </div>
          )}
          {hasMoreCompleted && !loading && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={loadMore}>
                {lang === 'nl' ? 'Meer laden' : 'Load more'} ({completedTotal - completed.length})
              </Button>
            </div>
          )}
        </div>
      )}

      {!loading && !hasAnyTasks && (
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

      {/* Edit Task Modal */}
      <TaskEditModal
        open={!!editTask}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSaved={() => { void load({ showToastOnError: false }) }}
      />

      {/* End Task Modal */}
      <EndTaskModal
        open={!!endingTask}
        onClose={() => setEndingTask(null)}
        onConfirm={confirmEndTask}
        task={endingTask ? {
          colliCount: endingTask.colliCount,
          discountContainer: endingTask.discountContainer,
          startedAt: endingTask.startedAt,
          personnel: endingTask.personnel
            .filter((p) => !p.endedAt)
            .map((p) => ({
              sessionId: p.sessionId,
              personnelId: p.personnelId,
              personnelName: p.personnelName,
              startedAt: p.startedAt,
            })),
        } : null}
        loading={endingSaving}
      />

      {/* Rating Modal */}
      <RatingModal
        open={ratingQueue.length > 0}
        queue={ratingQueue}
        onSubmit={submitRating}
        onSkip={skipRating}
        onSkipAll={skipAllRatings}
        loading={ratingSaving}
      />

      {/* Task Notes Modal/Sheet */}
      <ModalOrSheet open={!!notesTask} onClose={() => setNotesTask(null)}>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.notes')}</h2>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
              {notesTask?.taskNotes ?? t('tasks.noNotes')}
            </p>
          </div>
        </div>
      </ModalOrSheet>

      <ModalOrSheet open={showDiscountInfo} onClose={() => setShowDiscountInfo(false)}>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.discountContainerTitle')}</h2>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerDescription')}</p>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerNote')}</p>
        </div>
      </ModalOrSheet>


      {/* Delete Confirm Modal */}
      <ModalOrSheet open={!!deleteTaskId} onClose={() => setDeleteTaskId(null)}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.deleteTask')}</h2>
          <p className="text-sm text-gray-600">{t('tasks.confirmDelete')}</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={confirmDelete} className="flex-1">{t('common.delete')}</Button>
            <Button variant="secondary" onClick={() => setDeleteTaskId(null)} className="flex-1">{t('common.cancel')}</Button>
          </div>
        </div>
      </ModalOrSheet>
    </div>
  )
}

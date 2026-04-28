'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { Skeleton } from '@/components/ui/Skeleton'
import { TaskEditModal } from '@/components/ui/TaskEditModal'
import { getDepartmentLabel } from '@/lib/departments'
import { formatTime, formatDate, formatDuration, calcExpectedMinutesFromSessionStarts } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import type { Task } from '@/lib/db/schema'

interface SessionDetail {
  id: string
  personnelId: string
  personnelName: string
  startedAt: string
  endedAt: string | null
  totalPausedMinutes: number
  workDate: string
  expectedSessionMinutes: number
  actualMinutes: number | null
  performanceDiff: number | null
}

interface TaskRating {
  personnelId: string
  personnelName: string
  workEthicScore: number
  qualityScore: number
  teamworkScore: number
  comment: string | null
}

interface TaskDetail extends Task {
  sessions: SessionDetail[]
  ratings: TaskRating[]
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function RatingValue({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-gray-900 tabular-nums">
        {value.toFixed(1)}
      </div>
    </div>
  )
}

export default function TaskDetailPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showDiscountInfo, setShowDiscountInfo] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/tasks/${params.id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!showActions) return
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showActions])

  const confirmDelete = async () => {
    if (!data || deleting) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/tasks/${data.id}`, { method: 'DELETE' })
      if (!res.ok) return
      setDeleteOpen(false)
      router.push('/tasks')
    } finally {
      setDeleting(false)
    }
  }

  const sessions = data?.sessions ?? []
  const activeSessions = sessions.filter((s) => !s.endedAt)
  const isActive = activeSessions.length > 0
  const completed = sessions.filter((s) => s.endedAt)

  const completedWithDiff = completed.filter((s) => s.performanceDiff !== null)
  const avgDiff = completedWithDiff.length > 0
    ? completedWithDiff.reduce((sum, s) => sum + Number(s.performanceDiff!), 0) / completedWithDiff.length
    : null
  const withActual = completed.filter((s) => s.actualMinutes !== null)
  const avgActual = withActual.length > 0
    ? withActual.reduce((sum, s) => sum + Number(s.actualMinutes!), 0) / withActual.length
    : null

  const earliestStart = sessions.reduce<string | null>(
    (acc, s) => !acc || s.startedAt < acc ? s.startedAt : acc, null)
  const latestEnd = !isActive && completed.length > 0
    ? completed.reduce<string | null>(
      (acc, s) => s.endedAt && (!acc || s.endedAt > acc) ? s.endedAt : acc, null)
    : null

  const accent = isActive ? '#80BC17' : avgDiff === null ? '#9CA3AF' : avgDiff <= 0.5 ? '#80BC17' : '#E40B17'

  const plannedEndTs = (() => {
    if (!data) return []
    const startTimes = sessions.map((s) => s.startedAt)
    const anchorTs = Math.min(...startTimes.map((value) => new Date(value).getTime()).filter((ts) => Number.isFinite(ts)))
    if (!Number.isFinite(anchorTs)) return []

    const projectedExpectedMinutes = calcExpectedMinutesFromSessionStarts(
      data.colliCount,
      startTimes,
      data.discountContainer,
    )
    const pausedMinutes = Math.max(...sessions.map((s) => Number(s.totalPausedMinutes ?? 0)), 0)
    return [anchorTs + (projectedExpectedMinutes + pausedMinutes) * 60_000]
  })()
  const plannedEndLabel = plannedEndTs.length > 0
    ? formatTime(new Date(Math.max(...plannedEndTs)).toISOString())
    : null

  const departmentLabel = data ? getDepartmentLabel(data.department, lang) : ''
  const workDateSource = data?.sessions[0]?.workDate ?? data?.createdAt ?? null
  const workDateLabel = workDateSource ? formatDate(workDateSource) : ''
  const ratingsByPersonnelId = new Map((data?.ratings ?? []).map((rating) => [rating.personnelId, rating]))

  return (
    <div className="space-y-4">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/tasks"
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0"
          aria-label={t('common.back')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0 text-center">
          {!loading && data && (
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest truncate">
              {t('tasks.title')}
            </div>
          )}
        </div>

        {data && !loading ? (
          <div ref={actionsRef} className="relative">
            <button
              type="button"
              onClick={() => setShowActions((v) => !v)}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex items-center justify-center flex-shrink-0"
              aria-label={t('tasks.actions')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6h.01M12 12h.01M12 18h.01" />
              </svg>
            </button>
            {showActions && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
                <button
                  type="button"
                  onClick={() => { setEditOpen(true); setShowActions(false) }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('tasks.editTask')}
                </button>
                <button
                  type="button"
                  onClick={() => { setDeleteOpen(true); setShowActions(false) }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  {t('tasks.deleteTask')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-9 h-9 flex-shrink-0" />
        )}
      </div>

      {loading ? (
        <>
          <Card padding="none" className="overflow-hidden">
            <div className="flex">
              <div className="w-1.5 bg-gray-200" />
              <div className="flex-1 p-5 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          </Card>
          <Skeleton className="h-16 rounded-xl" />
        </>
      ) : !data ? (
        <div className="text-center py-20 text-gray-500">{t('common.noResults')}</div>
      ) : (
        <>
          {/* Card 1 — Identity */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex">
              <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: accent }} />
              <div className="flex-1 p-5">
                {/* Status + Date */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: isActive ? '#80BC1720' : '#F3F4F6',
                      color: isActive ? '#1C7745' : '#4B5563',
                    }}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}
                      style={{ backgroundColor: accent }}
                    />
                    {isActive ? t('tasks.inProgress') : t('tasks.finished')}
                  </div>
                  <div className="text-xs text-gray-400 font-medium tabular-nums">{workDateLabel}</div>
                </div>

                {/* Department + Colli */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-gray-900 leading-tight">
                      {departmentLabel}
                    </h1>
                    {data.discountContainer && (
                      <button
                        type="button"
                        onClick={() => setShowDiscountInfo(true)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[11px] font-black text-red-600 ring-1 ring-red-200 flex-shrink-0"
                        aria-label={t('tasks.discountContainerBadge')}
                      >
                        %
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-gray-700 tabular-nums">{data.colliCount}</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('tasks.colli')}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2 — Timeline */}
          {earliestStart && (
            <Card padding="sm">
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                {/* Start */}
                <div className="pr-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t('tasks.started')}
                  </div>
                  <div className="text-base font-bold text-gray-900 tabular-nums leading-tight">
                    {formatTime(earliestStart)}
                  </div>
                </div>

                {/* Planned end */}
                <div className="px-4 text-center">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t('tasks.planned')}
                  </div>
                  <div className="text-base font-bold text-gray-400 tabular-nums leading-tight">
                    {plannedEndLabel ?? '—'}
                  </div>
                  <div className="text-[10px] text-gray-300 mt-0.5 tabular-nums">
                    {data.expectedMinutes}m
                  </div>
                </div>

                {/* Actual end */}
                <div className="pl-4 text-right">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t('tasks.ended')}
                  </div>
                  <div
                    className="text-base font-bold tabular-nums leading-tight"
                    style={{ color: isActive ? '#9CA3AF' : '#111827' }}
                  >
                    {latestEnd ? formatTime(latestEnd) : '—'}
                  </div>
                  {!isActive && avgActual !== null && (
                    <div className="text-[10px] text-gray-300 mt-0.5 tabular-nums">
                      {formatDuration(avgActual)}
                    </div>
                  )}
                </div>
              </div>

              {/* Performance diff row */}
              {!isActive && avgDiff !== null && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {lang === 'nl' ? 'Gemiddeld verschil' : 'Average difference'}
                  </span>
                  <PerformanceDiff diffMinutes={avgDiff} />
                </div>
              )}
            </Card>
          )}

          {/* Card 3 — Notes */}
          {data.notes && (
            <Card padding="sm">
              <div className="flex gap-3">
                <div className="w-1 self-stretch rounded-full bg-amber-300 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1">
                    {t('tasks.notes')}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{data.notes}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Card 4 — Team */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {sessions.length === 1 ? t('personnel.title') : t('tasks.team')}
              </h2>
              {sessions.length > 1 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 tabular-nums">
                  {sessions.length}
                </span>
              )}
            </div>
            <Card padding="none">
              <div className="divide-y divide-gray-100">
                {sessions.map((s) => {
                  const sessionActive = !s.endedAt
                  const rating = ratingsByPersonnelId.get(s.personnelId)
                  const overallScore = rating
                    ? (rating.workEthicScore + rating.qualityScore + rating.teamworkScore) / 3
                    : null
                  return (
                    <Link
                      key={s.id}
                      href={`/personnel/${s.personnelId}`}
                      className="group block rounded-2xl px-4 py-3.5 transition-colors duration-150 ring-1 ring-transparent hover:bg-gray-50 hover:ring-gray-200 active:bg-gray-100"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <span
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 relative mt-0.5"
                          style={{
                            backgroundColor: sessionActive ? '#80BC1725' : '#F3F4F6',
                            color: sessionActive ? '#1C7745' : '#6B7280',
                          }}
                        >
                          {initials(s.personnelName)}
                          {sessionActive && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white animate-pulse"
                              style={{ backgroundColor: '#80BC17' }}
                            />
                          )}
                        </span>

                        {/* Name + time */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 truncate">{s.personnelName}</div>
                          <div className="text-xs text-gray-500 tabular-nums mt-0.5">
                            {sessionActive ? (
                              <>
                                <span className="text-[#1C7745] font-medium">{t('tasks.busy')}</span>
                                <span className="text-gray-300 mx-1.5">·</span>
                                <span>{formatTime(s.startedAt)}</span>
                              </>
                            ) : (
                              <span>{formatTime(s.startedAt)} – {s.endedAt ? formatTime(s.endedAt) : '—'}</span>
                            )}
                          </div>
                        </div>

                        {/* Metrics */}
                        {!sessionActive && (
                          <div className="flex-shrink-0 flex flex-col items-end gap-1 pt-0.5">
                            {s.actualMinutes !== null && (
                              <span className="text-sm font-bold text-gray-800 tabular-nums">
                                {formatDuration(Number(s.actualMinutes))}
                              </span>
                            )}
                            {s.performanceDiff !== null && (
                              <PerformanceDiff diffMinutes={Number(s.performanceDiff)} />
                            )}
                          </div>
                        )}

                        {/* Chevron — indicates profile navigation */}
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 ml-1 mt-1 transition-colors group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {rating && overallScore !== null && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="grid grid-cols-4 gap-3 sm:gap-4">
                            <RatingValue label={t('ratings.workEthicLabel')} value={rating.workEthicScore} />
                            <RatingValue label={t('ratings.qualityLabel')} value={rating.qualityScore} />
                            <RatingValue label={t('ratings.teamworkLabel')} value={rating.teamworkScore} />
                            <RatingValue label={t('ratings.overallScore')} value={overallScore} />
                          </div>
                          {rating.comment && (
                            <div className="mt-3">
                              <p className="text-xs leading-5 text-gray-600 whitespace-pre-wrap break-words">
                                {rating.comment}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      )}

      {data && (
        <TaskEditModal
          open={editOpen}
          task={data}
          onClose={() => setEditOpen(false)}
          onSaved={load}
        />
      )}

      <ModalOrSheet open={showDiscountInfo} onClose={() => setShowDiscountInfo(false)}>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.discountContainerTitle')}</h2>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerDescription')}</p>
          <p className="text-sm text-gray-700">{t('tasks.discountContainerNote')}</p>
        </div>
      </ModalOrSheet>

      <ModalOrSheet
        open={deleteOpen}
        onClose={() => { if (!deleting) setDeleteOpen(false) }}
      >
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.deleteTask')}</h2>
          <p className="text-sm text-gray-600">{t('tasks.confirmDelete')}</p>
          <div className="flex gap-3">
            <Button
              variant="danger"
              className="flex-1"
              loading={deleting}
              onClick={() => { void confirmDelete() }}
            >
              {t('common.delete')}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </ModalOrSheet>
    </div>
  )
}

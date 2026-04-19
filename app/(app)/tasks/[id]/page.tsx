'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { PerformanceDiff } from '@/components/ui/PerformanceDiff'
import { Skeleton } from '@/components/ui/Skeleton'
import { TaskEditModal } from '@/components/ui/TaskEditModal'
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

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function TaskDetailPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/tasks/${params.id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { void load() }, [load])

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
  const accentSoft = isActive ? '#80BC1710' : avgDiff === null ? '#9CA3AF10' : avgDiff <= 0.5 ? '#80BC1710' : '#E40B1710'

  const departmentLabel = data ? getDepartmentLabel(data.department, lang) : ''
  const workDateSource = data?.sessions[0]?.workDate ?? data?.createdAt ?? null
  const workDateLabel = workDateSource ? formatDate(workDateSource) : ''

  return (
    <div className="space-y-5">
      {/* Header */}
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
          {loading ? (
            <Skeleton className="h-3 w-24 mx-auto" />
          ) : data ? (
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest truncate">
              {t('tasks.title')}
            </div>
          ) : null}
        </div>

        {data && !loading ? (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex items-center justify-center flex-shrink-0"
            aria-label={t('tasks.editTask')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        ) : (
          <div className="w-9 h-9 flex-shrink-0" />
        )}
      </div>

      {loading ? (
        <>
          <Card padding="none" className="overflow-hidden">
            <div className="flex">
              <div className="w-1.5 bg-gray-200" />
              <div className="flex-1 p-5 space-y-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-12 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </>
      ) : !data ? (
        <div className="text-center py-20 text-gray-500">{t('common.noResults')}</div>
      ) : (
        <>
          {/* Hero: task identity */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex">
              <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: accent }} />
              <div className="flex-1 p-5 space-y-5" style={{ backgroundColor: accentSoft }}>
                {/* Row 1: department + status */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 truncate">
                    {departmentLabel}
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex-shrink-0"
                    style={{
                      backgroundColor: isActive ? '#80BC1720' : '#F3F4F6',
                      color: isActive ? '#1C7745' : '#4B5563',
                    }}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`}
                      style={{ backgroundColor: accent }}
                    />
                    {isActive ? t('tasks.inProgress') : t('tasks.finished')}
                  </div>
                </div>

                {/* Row 2: colli count — the big number */}
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-gray-900 tabular-nums leading-none tracking-tight">
                        {data.colliCount}
                      </span>
                      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        {t('tasks.colli')}
                      </span>
                    </div>
                    <div className="mt-1.5 text-xs text-gray-500 tabular-nums">
                      {workDateLabel}
                    </div>
                  </div>
                  {!isActive && avgDiff !== null && (
                    <div className="flex-shrink-0 scale-110 origin-right">
                      <PerformanceDiff diffMinutes={avgDiff} />
                    </div>
                  )}
                </div>

                {/* Row 3: timeline */}
                {earliestStart && (
                  <div className="pt-3 border-t border-gray-200/60">
                    <TimelineRow
                      startedAt={earliestStart}
                      endedAt={latestEnd}
                      isActive={isActive}
                      accent={accent}
                      lang={lang}
                      startLabel={t('tasks.started')}
                      endLabel={t('tasks.ended')}
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label={t('tasks.planned')}
              value={`${data.expectedMinutes}m`}
              accent="#6B7280"
            />
            <StatTile
              label={t('tasks.timeWorked')}
              value={isActive ? '—' : avgActual !== null ? formatDuration(avgActual) : '—'}
              accent={isActive ? '#9CA3AF' : '#111827'}
              muted={isActive}
            />
            <StatTile
              label={sessions.length === 1 ? t('personnel.title') : t('tasks.team')}
              value={String(sessions.length)}
              accent="#111827"
              suffix={sessions.length === 1 ? '' : ''}
            />
          </div>

          {/* Notes */}
          {data.notes && (
            <Card padding="sm">
              <div className="flex gap-3">
                <div className="w-1 self-stretch rounded-full bg-amber-300 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">
                    {t('tasks.notes')}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{data.notes}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Team / Sessions */}
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
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 relative"
                        style={{
                          backgroundColor: sessionActive ? '#80BC17' + '25' : '#F3F4F6',
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
                            <span>{formatTime(s.startedAt)} – {s.endedAt ? formatTime(s.endedAt) : '-'}</span>
                          )}
                        </div>
                      </div>
                      {!sessionActive && (
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
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
                    </div>
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
    </div>
  )
}

function StatTile({
  label,
  value,
  accent,
  muted = false,
  suffix = '',
}: {
  label: string
  value: string
  accent: string
  muted?: boolean
  suffix?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 flex flex-col justify-between min-h-[72px]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={`text-xl font-bold tabular-nums leading-none ${muted ? 'text-gray-300' : ''}`}
          style={muted ? undefined : { color: accent }}
        >
          {value}
        </span>
        {suffix && <span className="text-xs font-medium text-gray-400">{suffix}</span>}
      </div>
    </div>
  )
}

function TimelineRow({
  startedAt,
  endedAt,
  isActive,
  accent,
  lang,
  startLabel,
  endLabel,
}: {
  startedAt: string
  endedAt: string | null
  isActive: boolean
  accent: string
  lang: 'nl' | 'en'
  startLabel: string
  endLabel: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{startLabel}</div>
        <div className="text-base font-bold text-gray-900 tabular-nums leading-tight">
          {formatTime(startedAt)}
        </div>
      </div>
      <div className="flex-1 relative flex items-center px-2" aria-hidden="true">
        <div className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.4 }} />
        {isActive ? (
          <div className="flex items-center gap-1 px-2">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent, animationDelay: '200ms' }} />
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent, animationDelay: '400ms' }} />
          </div>
        ) : (
          <svg className="w-3 h-3 mx-1 flex-shrink-0" style={{ color: accent }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
        <div className="h-px flex-1" style={{ backgroundColor: accent, opacity: 0.4 }} />
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{endLabel}</div>
        <div className="text-base font-bold tabular-nums leading-tight" style={{ color: isActive ? '#9CA3AF' : '#111827' }}>
          {endedAt ? formatTime(endedAt) : (lang === 'nl' ? '—' : '—')}
        </div>
      </div>
    </div>
  )
}

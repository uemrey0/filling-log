'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDurationWithSeconds } from '@/lib/business'
import { apiFetch } from '@/lib/api'

interface PersonnelStat {
  personnelId: string
  personnelName: string
  sessionCount: number
  avgActualPerColli: number | null
}

type Preset = '7d' | '30d' | '90d' | 'all'

const RANK_STYLES = [
  { bg: '#FFFBEB', color: '#92400E', badge: '#FCD34D' },
  { bg: '#F8FAFC', color: '#475569', badge: '#CBD5E1' },
  { bg: '#FFF7ED', color: '#9A3412', badge: '#FDBA74' },
]

function getDateRange(preset: Preset): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (preset === 'all') return { dateFrom: '', dateTo: '' }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const from = new Date(now)
  from.setDate(from.getDate() - days)
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: today }
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function LeaderboardPage() {
  const { t, lang } = useLanguage()
  const [preset, setPreset] = useState<Preset>('30d')
  const [personnel, setPersonnel] = useState<PersonnelStat[]>([])
  const [loading, setLoading] = useState(true)

  const presets: { key: Preset; label: string }[] = [
    { key: '7d', label: t('personnel.last7d') },
    { key: '30d', label: t('personnel.last30d') },
    { key: '90d', label: t('personnel.last90d') },
    { key: 'all', label: t('personnel.allTime') },
  ]

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { dateFrom, dateTo } = getDateRange(preset)
        const params = new URLSearchParams()
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        const res = await apiFetch(`/api/analytics?${params}`)
        if (!cancelled && res.ok) {
          const json = await res.json()
          const sorted = ((json.byPersonnel ?? []) as PersonnelStat[])
            .filter((p) => p.avgActualPerColli !== null)
            .sort((a, b) => (a.avgActualPerColli ?? Infinity) - (b.avgActualPerColli ?? Infinity))
          setPersonnel(sorted)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [preset])

  return (
    <div className="space-y-5">
      <PageHeader title={lang === 'nl' ? 'Ranglijst' : 'Leaderboard'} />

      {/* Preset filter */}
      <div className="flex gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors"
            style={
              preset === p.key
                ? { backgroundColor: '#80BC17', color: '#fff', borderColor: '#80BC17' }
                : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card padding="none">
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </Card>
      ) : personnel.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-sm text-gray-500">{t('analytics.noData')}</div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-gray-100">
            {personnel.map((p, idx) => {
              const rank = idx + 1
              const style = idx < 3 ? RANK_STYLES[idx] : null

              return (
                <Link
                  key={p.personnelId}
                  href={`/personnel/${p.personnelId}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  {/* Rank badge */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={
                      style
                        ? { backgroundColor: style.badge, color: style.color }
                        : { backgroundColor: '#F3F4F6', color: '#9CA3AF' }
                    }
                  >
                    {rank}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={
                      style
                        ? { backgroundColor: style.badge + '60', color: style.color }
                        : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                    }
                  >
                    {initials(p.personnelName)}
                  </div>

                  {/* Name + sessions */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{p.personnelName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.sessionCount} {lang === 'nl' ? 'sessies' : 'sessions'}
                    </div>
                  </div>

                  {/* Time per colli */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatDurationWithSeconds(p.avgActualPerColli!)}
                    </div>
                    <div className="text-[10px] text-gray-400">/ colli</div>
                  </div>

                  {/* Chevron */}
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

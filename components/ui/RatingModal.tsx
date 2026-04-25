'use client'

import { useState } from 'react'
import { ModalOrSheet } from './ModalOrSheet'
import { Button } from './Button'
import { useLanguage } from '@/components/providers/LanguageProvider'

export interface RatingTarget {
  personnelId: string
  personnelName: string
  taskId: string
}

export interface RatingData {
  personnelId: string
  taskId: string
  workEthicScore: number
  qualityScore: number
  teamworkScore: number
  comment: string
}

interface RatingModalProps {
  open: boolean
  queue: RatingTarget[]
  onSubmit: (data: RatingData) => Promise<void>
  onSkip: () => void
  onSkipAll: () => void
  loading?: boolean
}

function StarRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (v: number) => void
}) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="space-y-1.5">
      <div>
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{hint}</div>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= (hovered || value)
          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(n)}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
              style={{ backgroundColor: filled ? '#80BC1720' : '#F3F4F6' }}
              aria-label={`${n} ster`}
            >
              <svg
                className="w-6 h-6 transition-colors"
                fill={filled ? '#80BC17' : 'none'}
                stroke={filled ? '#80BC17' : '#D1D5DB'}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function RatingModal({
  open,
  queue,
  onSubmit,
  onSkip,
  onSkipAll,
  loading = false,
}: RatingModalProps) {
  const { t, lang } = useLanguage()
  const [workEthic, setWorkEthic] = useState(0)
  const [quality, setQuality] = useState(0)
  const [teamwork, setTeamwork] = useState(0)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevQueueLen, setPrevQueueLen] = useState(queue.length)

  if (open !== prevOpen || queue.length !== prevQueueLen) {
    setPrevOpen(open)
    setPrevQueueLen(queue.length)
    if (open) {
      setWorkEthic(0)
      setQuality(0)
      setTeamwork(0)
      setComment('')
      setShowComment(false)
    }
  }

  const current = queue[0]
  const total = queue.length
  const canSubmit = workEthic > 0 && quality > 0 && teamwork > 0 && !loading

  if (!current) return null

  const handleSubmit = async () => {
    if (!canSubmit) return
    await onSubmit({
      personnelId: current.personnelId,
      taskId: current.taskId,
      workEthicScore: workEthic,
      qualityScore: quality,
      teamworkScore: teamwork,
      comment: comment.trim(),
    })
  }

  const copy = lang === 'nl'
    ? { for: 'Beoordeel', tapToRate: t('ratings.tapToRate') }
    : { for: 'Rate', tapToRate: t('ratings.tapToRate') }

  return (
    <ModalOrSheet open={open} onClose={loading ? undefined : onSkipAll}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#80BC1725', color: '#1C7745' }}
            >
              {initials(current.personnelName)}
            </span>
            <div>
              <div className="text-xs text-gray-500 font-medium">{t('ratings.title')}</div>
              <div className="text-base font-bold text-gray-900 leading-tight">{current.personnelName}</div>
            </div>
          </div>
          {total > 1 && (
            <div className="text-xs text-gray-400 font-medium tabular-nums pt-1">
              1 {t('ratings.personOf')} {total}
            </div>
          )}
        </div>

        {/* Star questions */}
        <div className="space-y-4">
          <StarRow
            label={t('ratings.workEthicLabel')}
            hint={t('ratings.workEthicHint')}
            value={workEthic}
            onChange={setWorkEthic}
          />
          <StarRow
            label={t('ratings.qualityLabel')}
            hint={t('ratings.qualityHint')}
            value={quality}
            onChange={setQuality}
          />
          <StarRow
            label={t('ratings.teamworkLabel')}
            hint={t('ratings.teamworkHint')}
            value={teamwork}
            onChange={setTeamwork}
          />
        </div>

        {/* Optional comment */}
        {showComment ? (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('ratings.commentLabel')}</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('ratings.commentPlaceholder')}
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': '#80BC17' } as React.CSSProperties}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowComment(true)}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('ratings.addComment')}
          </button>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onSkip} disabled={loading} className="flex-1">
            {t('ratings.skip')}
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!canSubmit} className="flex-1">
            {total > 1 ? t('ratings.next') : t('ratings.submit')}
          </Button>
        </div>
      </div>
    </ModalOrSheet>
  )
}

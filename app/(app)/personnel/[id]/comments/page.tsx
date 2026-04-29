'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

interface Comment {
  id: string
  content: string
  createdAt: string
}

interface PersonnelInfo {
  id: string
  fullName: string
}

function formatRelativeTime(dateStr: string, lang: 'nl' | 'en'): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return lang === 'nl' ? 'Vandaag' : 'Today'
  if (days === 1) return lang === 'nl' ? 'Gisteren' : 'Yesterday'
  if (days < 7) return lang === 'nl' ? `${days} dagen geleden` : `${days} days ago`
  return formatDate(dateStr)
}

export default function PersonnelCommentsPage() {
  const { t, lang } = useLanguage()
  const params = useParams<{ id: string }>()

  const [info, setInfo] = useState<PersonnelInfo | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showAddComment, setShowAddComment] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [savingComment, setSavingComment] = useState(false)

  const PAGE_SIZE = 20

  const loadComments = useCallback(async (p: number, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await apiFetch(`/api/personnel/${params.id}/comments?page=${p}&limit=${PAGE_SIZE}`)
      if (res.ok) {
        const data = await res.json()
        if (append) {
          setComments((prev) => [...prev, ...(data.comments ?? [])])
        } else {
          setComments(data.comments ?? [])
        }
        setTotal(data.total ?? 0)
        setPage(p)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [params.id])

  const loadInfo = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/personnel/${params.id}?page=1&limit=1`)
      if (res.ok) {
        const data = await res.json()
        setInfo({ id: data.id, fullName: data.fullName })
      }
    } catch { /* no-op */ }
  }, [params.id])

  useEffect(() => {
    void loadInfo()
    void loadComments(1)
  }, [loadInfo, loadComments])

  const saveComment = async () => {
    const content = newComment.trim()
    if (!content) return
    setSavingComment(true)
    try {
      const res = await apiFetch(`/api/personnel/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setNewComment('')
        setShowAddComment(false)
        await loadComments(1)
      } else {
        toast.error(lang === 'nl' ? 'Opmerking opslaan mislukt.' : 'Failed to save comment.')
      }
    } finally {
      setSavingComment(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    const confirmed = window.confirm(t('personnel.confirmDeleteComment'))
    if (!confirmed) return
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      await loadComments(1)
    } catch { /* no-op */ }
  }

  const hasMore = comments.length < total

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton
            fallbackHref={`/personnel/${params.id}`}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0"
            aria-label={t('common.back')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </BackButton>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{t('personnel.allCommentsTitle')}</h1>
            {info && <div className="text-sm text-gray-500 truncate">{info.fullName}</div>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddComment(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          {t('personnel.addComment')}
        </button>
      </div>

      {/* Comments list */}
      {loading ? (
        <Card padding="none">
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </Card>
      ) : comments.length === 0 ? (
        <Card>
          <EmptyState title={t('personnel.noComments')} />
        </Card>
      ) : (
        <>
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {comments.map((c) => (
                <div key={c.id} className="px-4 py-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-800 flex-1 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 shrink-0 mt-0.5"
                      aria-label={t('personnel.deleteComment')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{formatRelativeTime(c.createdAt, lang)}</div>
                </div>
              ))}
            </div>
          </Card>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                loading={loadingMore}
                onClick={() => loadComments(page + 1, true)}
              >
                {t('common.loadMore')} ({total - comments.length})
              </Button>
            </div>
          )}
        </>
      )}

      {/* Add comment sheet */}
      <ModalOrSheet open={showAddComment} onClose={() => { setShowAddComment(false); setNewComment('') }}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{t('personnel.addComment')}</h2>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('personnel.commentPlaceholder')}
            rows={5}
            autoFocus
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
            style={{ '--tw-ring-color': '#80BC17' } as React.CSSProperties}
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => { setShowAddComment(false); setNewComment('') }}
              className="flex-1"
              disabled={savingComment}
            >
              {t('personnel.cancel')}
            </Button>
            <Button
              onClick={saveComment}
              loading={savingComment}
              disabled={!newComment.trim()}
              className="flex-1"
            >
              {t('personnel.save')}
            </Button>
          </div>
        </div>
      </ModalOrSheet>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { Personnel } from '@/lib/db/schema'

export default function EditPersonnelPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ fullName: '', notes: '', isActive: true })

  useEffect(() => {
    fetch(`/api/personnel/${params.id}`)
      .then((r) => r.json())
      .then((data: Personnel) => {
        setForm({ fullName: data.fullName, notes: data.notes ?? '', isActive: data.isActive })
      })
      .finally(() => setFetching(false))
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.fullName.trim()) errs.fullName = t('validation.required')
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await fetch(`/api/personnel/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: form.fullName.trim(), isActive: form.isActive, notes: form.notes.trim() || null }),
      })
      if (res.ok) {
        router.push('/personnel')
        router.refresh()
      } else {
        const data = await res.json()
        setErrors({ submit: data.error ?? t('common.error') })
      }
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <div className="flex justify-center py-20"><Spinner size="lg" className="text-primary" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/personnel" className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('personnel.editPersonnel')}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label={t('personnel.fullName')}
            placeholder={t('personnel.namePlaceholder')}
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            error={errors.fullName}
          />
          <Textarea
            label={t('personnel.notes')}
            placeholder={t('personnel.notesPlaceholder')}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">{t('personnel.status')}</label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-gray-300'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
            <span className="text-sm text-gray-600">
              {form.isActive ? t('personnel.active') : t('personnel.inactive')}
            </span>
          </div>
          {errors.submit && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errors.submit}
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" loading={loading} fullWidth>{t('personnel.save')}</Button>
            <Link href="/personnel" className="flex-1">
              <Button type="button" variant="secondary" fullWidth>{t('personnel.cancel')}</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}

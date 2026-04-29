'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { apiFetch } from '@/lib/api'
import { navigateBack } from '@/lib/navigation'

export default function NewPersonnelPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ fullName: '', notes: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.fullName.trim()) errs.fullName = t('validation.required')
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await apiFetch('/api/personnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: form.fullName.trim(), isActive: true, notes: form.notes.trim() || null }),
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/personnel" className="text-gray-500 hover:text-gray-700" aria-label={t('common.back')}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </BackButton>
        <h1 className="text-xl font-bold text-gray-900">{t('personnel.addPersonnel')}</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label={t('personnel.fullName')}
            placeholder={t('personnel.namePlaceholder')}
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            error={errors.fullName}
            autoFocus
          />
          <Textarea
            label={t('personnel.notes')}
            placeholder={t('personnel.notesPlaceholder')}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          {errors.submit && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errors.submit}
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" loading={loading} fullWidth>{t('personnel.save')}</Button>
            <Button type="button" variant="secondary" fullWidth onClick={() => navigateBack(router, '/personnel')}>{t('personnel.cancel')}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

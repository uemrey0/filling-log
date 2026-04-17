'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import { PersonnelCombobox, type PersonnelChip } from '@/components/ui/PersonnelCombobox'
import { ConflictResolution, type ConflictInfo, type ConflictResolutionResult } from '@/components/ui/ConflictResolution'
import { DEPARTMENT_KEYS, getDepartmentLabel } from '@/lib/departments'
import { calcExpectedMinutes } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import type { Personnel } from '@/lib/db/schema'

function getTodayLocalDate(): string {
  const now = new Date()
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localTime.toISOString().slice(0, 10)
}

export default function NewTaskPage() {
  const { t, lang } = useLanguage()
  const router = useRouter()

  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelChip[]>([])
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [showConflicts, setShowConflicts] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    department: '',
    colliCount: '',
    notes: '',
  })

  const expectedMinutes =
    form.colliCount && !isNaN(Number(form.colliCount)) && Number(form.colliCount) > 0
      ? calcExpectedMinutes(Number(form.colliCount), Math.max(1, selectedPersonnel.length))
      : null

  const loadPersonnel = useCallback(async () => {
    try {
      const res = await apiFetch('/api/personnel?active=true')
      if (res.ok) setPersonnel(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadPersonnel() }, [loadPersonnel])

  const handleAddNew = async (name: string): Promise<PersonnelChip> => {
    const res = await apiFetch('/api/personnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: name, isActive: true }),
    })
    const created: Personnel = await res.json()
    setPersonnel((prev) => [...prev, created].sort((a, b) => a.fullName.localeCompare(b.fullName)))
    return { id: created.id, fullName: created.fullName }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (selectedPersonnel.length === 0) e.personnel = t('validation.required')
    if (!form.department) e.department = t('validation.required')
    const colli = Number(form.colliCount)
    if (!form.colliCount || isNaN(colli) || colli < 1 || colli > 9999) e.colliCount = t('validation.required')
    return e
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    setCheckingConflicts(true)
    try {
      const ids = selectedPersonnel.map((p) => p.id).join(',')
      const res = await apiFetch(`/api/tasks/conflicts?personnelIds=${ids}`)
      if (!res.ok) throw new Error()
      const found: ConflictInfo[] = await res.json()

      if (found.length === 0) {
        await submitTask([])
      } else {
        setConflicts(found)
        setShowConflicts(true)
      }
    } catch {
      setErrors({ submit: t('common.error') })
    } finally {
      setCheckingConflicts(false)
    }
  }

  const handleConflictsResolved = async (results: ConflictResolutionResult[]) => {
    await submitTask(results)
    setShowConflicts(false)
  }

  const submitTask = async (resolvedConflicts: ConflictResolutionResult[]) => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnelIds: selectedPersonnel.map((p) => p.id),
          department: form.department,
          colliCount: Number(form.colliCount),
          notes: form.notes.trim() || null,
          workDate: getTodayLocalDate(),
          resolutions: resolvedConflicts,
        }),
      })
      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        const data = await res.json()
        setErrors({ submit: data.error ?? t('common.error') })
      }
    } finally {
      setLoading(false)
    }
  }

  const departmentOptions = DEPARTMENT_KEYS.map((key) => ({
    value: key,
    label: getDepartmentLabel(key, lang),
  }))

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-black">{t('taskForm.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{lang === 'nl' ? 'Vul de gegevens in om een taak te starten' : 'Fill in the details to start a task'}</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <PersonnelCombobox
            personnel={personnel}
            selected={selectedPersonnel}
            onSelect={(p) => setSelectedPersonnel((prev) => {
              if (prev.find((x) => x.id === p.id)) return prev
              return [...prev, p]
            })}
            onRemove={(id) => setSelectedPersonnel((prev) => prev.filter((p) => p.id !== id))}
            onAddNew={handleAddNew}
            label={t('tasks.personnel')}
            error={errors.personnel}
          />

          <Select
            label={t('taskForm.department')}
            options={departmentOptions}
            placeholder={t('taskForm.selectDepartment')}
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            error={errors.department}
          />

          <div>
            <Input
              label={t('taskForm.colliCount')}
              type="number"
              inputMode="numeric"
              placeholder={t('taskForm.colliPlaceholder')}
              value={form.colliCount}
              min={1}
              max={9999}
              onChange={(e) => setForm((f) => ({ ...f, colliCount: e.target.value }))}
              error={errors.colliCount}
            />
            {expectedMinutes !== null && (
              <div
                className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#80BC17' + '15', color: '#1C7745' }}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('taskForm.expectedMinutes')}:
                <span className="font-bold">{expectedMinutes} {t('taskForm.minutes')}</span>
              </div>
            )}
          </div>

          <Textarea
            label={t('taskForm.notes')}
            placeholder={t('taskForm.notesPlaceholder')}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          {errors.submit && (
            <div className="rounded-xl px-4 py-3 text-sm font-medium border" style={{ backgroundColor: '#FEF2F2', color: '#E40B17', borderColor: '#FCA5A5' }}>
              {errors.submit}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={checkingConflicts || loading} fullWidth size="lg">
              {t('taskForm.startTask')}
            </Button>
            <Link href="/dashboard" className="flex-1">
              <Button type="button" variant="secondary" fullWidth size="lg">
                {t('taskForm.cancel')}
              </Button>
            </Link>
          </div>
        </form>
      </Card>

      {/* Conflict resolution: modal on desktop, bottom sheet on mobile */}
      <ModalOrSheet open={showConflicts} onClose={loading ? undefined : () => setShowConflicts(false)}>
        <ConflictResolution
          conflicts={conflicts}
          onResolved={handleConflictsResolved}
          onCancel={() => setShowConflicts(false)}
          submitting={loading}
        />
      </ModalOrSheet>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { ModalOrSheet } from './ModalOrSheet'
import { Button } from './Button'
import { Input } from './Input'
import { Select } from './Select'
import { Textarea } from './Textarea'
import { PersonnelCombobox, type PersonnelChip } from './PersonnelCombobox'
import { DEPARTMENT_KEYS, getDepartmentLabel } from '@/lib/departments'
import { calcExpectedMinutes } from '@/lib/business'
import { apiFetch } from '@/lib/api'
import type { Personnel } from '@/lib/db/schema'

interface EditableTask {
  id: string
  department: string
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

interface TaskEditModalProps {
  open: boolean
  task: EditableTask | null
  onClose: () => void
  onSaved: () => void
}

interface EndTimeEdit {
  sessionId: string
  personnelName: string
  startedAt: string
  originalEndedAt: string
  value: string
}

function timeToLocalValue(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function localTimeToIso(time: string, reference: Date): string {
  const [hh, mm] = time.split(':').map(Number)
  const d = new Date(reference)
  d.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0)
  return d.toISOString()
}

export function TaskEditModal({ open, task, onClose, onSaved }: TaskEditModalProps) {
  const { t, lang } = useLanguage()
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [selectedPersonnel, setSelectedPersonnel] = useState<PersonnelChip[]>([])
  const [department, setDepartment] = useState('')
  const [colliCount, setColliCount] = useState('')
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTimeEdits, setEndTimeEdits] = useState<EndTimeEdit[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activeSessions = useMemo(
    () => task?.sessions.filter((s) => !s.endedAt) ?? [],
    [task],
  )
  const isActive = activeSessions.length > 0
  const isCompleted = !isActive
  const referenceStart = useMemo(
    () => (activeSessions[0] ? new Date(activeSessions[0].startedAt) : new Date()),
    [activeSessions],
  )

  useEffect(() => {
    if (!open || !task) return
    setDepartment(task.department)
    setColliCount(String(task.colliCount))
    setNotes(task.notes ?? '')
    setErrors({})
    const active = task.sessions.filter((s) => !s.endedAt)
    if (active.length > 0) {
      setSelectedPersonnel(active.map((s) => ({ id: s.personnelId, fullName: s.personnelName })))
      setStartTime(timeToLocalValue(active[0].startedAt))
    } else {
      setSelectedPersonnel([])
      setStartTime('')
    }
    setEndTimeEdits(
      task.sessions
        .filter((s) => s.endedAt)
        .map((s) => ({
          sessionId: s.id,
          personnelName: s.personnelName,
          startedAt: s.startedAt,
          originalEndedAt: s.endedAt!,
          value: timeToLocalValue(s.endedAt!),
        })),
    )
  }, [open, task])

  const loadPersonnel = useCallback(async () => {
    try {
      const res = await apiFetch('/api/personnel?active=true')
      if (res.ok) setPersonnel(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (open) loadPersonnel()
  }, [open, loadPersonnel])

  if (!task) return null

  const colliNumber = Number(colliCount)
  const colliValid = Number.isFinite(colliNumber) && Number.isInteger(colliNumber) && colliNumber >= 1 && colliNumber <= 9999
  const expectedPreview = isActive && colliValid
    ? calcExpectedMinutes(colliNumber, Math.max(1, isActive ? selectedPersonnel.length : 1))
    : null

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
    if (isActive) {
      if (!department) e.department = t('validation.required')
      if (!colliValid) e.colliCount = t('validation.required')
      if (selectedPersonnel.length === 0) e.personnel = t('validation.required')
    }
    for (const edit of endTimeEdits) {
      if (!edit.value) {
        e[`end-${edit.sessionId}`] = t('validation.required')
        continue
      }
      const iso = localTimeToIso(edit.value, new Date(edit.originalEndedAt))
      const start = new Date(edit.startedAt).getTime()
      if (new Date(iso).getTime() <= start) {
        e[`end-${edit.sessionId}`] = t('tasks.invalidTimeRange')
      }
    }
    return e
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        notes: notes.trim() ? notes.trim() : null,
      }
      if (isActive) {
        body.department = department
        body.colliCount = colliNumber
        body.personnelIds = selectedPersonnel.map((p) => p.id)
        if (startTime) body.startedAt = localTimeToIso(startTime, referenceStart)
      }
      const changedEnds = endTimeEdits.filter((edit) => {
        if (!edit.value) return false
        const newIso = localTimeToIso(edit.value, new Date(edit.originalEndedAt))
        return new Date(newIso).getTime() !== new Date(edit.originalEndedAt).getTime()
      })

      const res = await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrors({ submit: data.error ?? t('common.error') })
        return
      }

      for (const edit of changedEnds) {
        const newIso = localTimeToIso(edit.value, new Date(edit.originalEndedAt))
        const r = await apiFetch(`/api/sessions/${edit.sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endedAt: newIso }),
        })
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          setErrors({ submit: data.error ?? t('common.error') })
          return
        }
      }

      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const departmentOptions = DEPARTMENT_KEYS.map((key) => ({
    value: key,
    label: getDepartmentLabel(key, lang),
  }))

  const busy = saving

  return (
    <ModalOrSheet open={open} onClose={busy ? undefined : onClose}>
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('tasks.editTask')}</h2>
          {isCompleted && (
            <p className="text-xs text-gray-500 mt-1">{t('tasks.editCompletedHint')}</p>
          )}
        </div>

        <div className="space-y-4">
          {isActive && (
            <PersonnelCombobox
              personnel={personnel}
              selected={selectedPersonnel}
              onSelect={(p) => setSelectedPersonnel((prev) =>
                prev.find((x) => x.id === p.id) ? prev : [...prev, p],
              )}
              onRemove={(id) => setSelectedPersonnel((prev) => prev.filter((p) => p.id !== id))}
              onAddNew={handleAddNew}
              label={t('tasks.personnel')}
              error={errors.personnel}
            />
          )}

          {isActive && (
            <Select
              label={t('taskForm.department')}
              options={departmentOptions}
              placeholder={t('taskForm.selectDepartment')}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              error={errors.department}
            />
          )}

          {isActive && (
            <div>
              <Input
                label={t('taskForm.colliCount')}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={t('taskForm.colliPlaceholder')}
                value={colliCount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  const v = digits === '' ? '' : String(Math.max(1, Math.min(9999, Number(digits))))
                  setColliCount(v)
                }}
                error={errors.colliCount}
              />
              {expectedPreview !== null && (
                <div
                  className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: '#80BC17' + '15', color: '#1C7745' }}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('taskForm.expectedMinutes')}:
                  <span className="font-bold tabular-nums">{expectedPreview} {t('taskForm.minutes')}</span>
                </div>
              )}
            </div>
          )}

          {isActive && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-900">{t('tasks.startTime')}</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          )}

          {endTimeEdits.length === 1 ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-900">{t('tasks.endTime')}</label>
              <input
                type="time"
                value={endTimeEdits[0].value}
                onChange={(e) => {
                  const v = e.target.value
                  setEndTimeEdits((prev) => prev.map((x) => ({ ...x, value: v })))
                }}
                className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors[`end-${endTimeEdits[0].sessionId}`] ? 'border-accent-red ring-1 ring-accent-red' : 'border-gray-300'
                }`}
              />
              {errors[`end-${endTimeEdits[0].sessionId}`] && (
                <span className="text-xs text-accent-red font-medium">
                  {errors[`end-${endTimeEdits[0].sessionId}`]}
                </span>
              )}
            </div>
          ) : endTimeEdits.length > 1 ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-900">{t('tasks.endTimesPerPerson')}</label>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {endTimeEdits.map((edit) => {
                  const err = errors[`end-${edit.sessionId}`]
                  return (
                    <div key={edit.sessionId} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{edit.personnelName}</div>
                        <div className="text-xs text-gray-500 tabular-nums">
                          {timeToLocalValue(edit.startedAt)} –
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="time"
                          value={edit.value}
                          onChange={(e) => {
                            const v = e.target.value
                            setEndTimeEdits((prev) =>
                              prev.map((x) => (x.sessionId === edit.sessionId ? { ...x, value: v } : x)),
                            )
                          }}
                          className={`rounded-lg border px-3 py-2 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-primary ${
                            err ? 'border-accent-red ring-1 ring-accent-red' : 'border-gray-300'
                          }`}
                        />
                        {err && <span className="text-[11px] text-accent-red font-medium">{err}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <Textarea
            label={t('taskForm.notes')}
            placeholder={t('taskForm.notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {errors.submit && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium border"
            style={{ backgroundColor: '#FEF2F2', color: '#E40B17', borderColor: '#FCA5A5' }}
          >
            {errors.submit}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={busy} className="flex-1">
            {t('tasks.saveChanges')}
          </Button>
        </div>
      </div>
    </ModalOrSheet>
  )
}

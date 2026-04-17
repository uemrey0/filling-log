'use client'

import { useState } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from './Button'
import { getDepartmentLabel } from '@/lib/departments'

export interface ConflictInfo {
  taskId: string
  department: string
  colliCount: number
  expectedMinutes: number
  startedAt: string
  sessions: Array<{
    sessionId: string
    personnelId: string
    personnelName: string
  }>
}

export interface ConflictResolutionResult {
  taskId: string
  isDone: boolean
  remainingColli?: number
}

interface ConflictResolutionProps {
  conflicts: ConflictInfo[]
  onResolved: (results: ConflictResolutionResult[]) => void
  onCancel: () => void
  submitting?: boolean
}

type Resolution = {
  isDone: boolean | null
  remainingColli: string
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function ConflictResolution({ conflicts, onResolved, onCancel, submitting = false }: ConflictResolutionProps) {
  const { lang } = useLanguage()

  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    Object.fromEntries(conflicts.map((c) => [c.taskId, { isDone: null, remainingColli: '' }])),
  )

  const setIsDone = (taskId: string, val: boolean) => {
    setResolutions((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], isDone: val },
    }))
  }

  const setRemainingColli = (taskId: string, val: string) => {
    setResolutions((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], remainingColli: val },
    }))
  }

  const canSubmit = conflicts.every((c) => {
    const r = resolutions[c.taskId]
    if (r.isDone === null) return false
    if (!r.isDone) {
      const n = Number(r.remainingColli)
      if (!r.remainingColli || isNaN(n) || n < 1 || n >= c.colliCount) return false
    }
    return true
  })

  const handleSubmit = () => {
    const results: ConflictResolutionResult[] = conflicts.map((c) => {
      const r = resolutions[c.taskId]
      return {
        taskId: c.taskId,
        isDone: r.isDone!,
        remainingColli: !r.isDone ? Number(r.remainingColli) : undefined,
      }
    })
    onResolved(results)
  }

  const texts = {
    nl: {
      title: 'Lopende taak afsluiten',
      subtitle: 'Er is al een actieve taak voor deze medewerker(s)',
      taskDone: 'Is de taak volledig afgerond?',
      yes: 'Ja, klaar',
      no: 'Nee, nog bezig',
      remainingLabel: 'Hoeveel colli zijn er nog over?',
      remainingPlaceholder: 'Aantal colli',
      of: 'van',
      colliLeft: 'colli totaal',
      continue: 'Doorgaan',
      cancel: 'Annuleren',
      autoNote: (remaining: number, dept: string) =>
        `Er wordt automatisch een nieuwe taak van ${remaining} colli aangemaakt voor de overige medewerker(s) in ${dept}.`,
    },
    en: {
      title: 'Close active task',
      subtitle: 'There is already an active task for these personnel',
      taskDone: 'Is the task fully completed?',
      yes: 'Yes, done',
      no: 'No, still ongoing',
      remainingLabel: 'How many colli are remaining?',
      remainingPlaceholder: 'Colli count',
      of: 'of',
      colliLeft: 'colli total',
      continue: 'Continue',
      cancel: 'Cancel',
      autoNote: (remaining: number, dept: string) =>
        `A new ${remaining} colli task will be automatically created for other personnel in ${dept}.`,
    },
  }

  const tx = texts[lang]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-black text-base">{tx.title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{tx.subtitle}</p>
      </div>

      {conflicts.map((conflict) => {
        const r = resolutions[conflict.taskId]
        const remaining = Number(r.remainingColli)
        const validRemaining = !isNaN(remaining) && remaining >= 1 && remaining < conflict.colliCount

        return (
          <div
            key={conflict.taskId}
            className="rounded-xl border-2 p-4 space-y-4"
            style={{ borderColor: '#80BC17' + '40', backgroundColor: '#80BC17' + '05' }}
          >
            {/* Personnel avatars */}
            <div className="flex flex-wrap gap-2">
              {conflict.sessions.map((session) => (
                <div key={session.sessionId} className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: '#80BC17' + '25', color: '#1C7745' }}
                  >
                    {initials(session.personnelName)}
                  </span>
                  <span className="text-sm font-semibold text-black">{session.personnelName}</span>
                </div>
              ))}
            </div>

            {/* Task info */}
            <div className="flex gap-3 text-sm">
              <span className="font-medium text-gray-700">
                {getDepartmentLabel(conflict.department, lang)}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{conflict.colliCount} colli</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">{conflict.expectedMinutes}m</span>
            </div>

            {/* Is done question */}
            <div>
              <div className="text-sm font-semibold text-gray-800 mb-2">{tx.taskDone}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDone(conflict.taskId, true)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={
                    r.isDone === true
                      ? { borderColor: '#80BC17', backgroundColor: '#80BC17' + '15', color: '#1C7745' }
                      : { borderColor: '#E5E7EB', backgroundColor: '#fff', color: '#374151' }
                  }
                >
                  {tx.yes}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDone(conflict.taskId, false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={
                    r.isDone === false
                      ? { borderColor: '#E40B17', backgroundColor: '#E40B17' + '10', color: '#E40B17' }
                      : { borderColor: '#E5E7EB', backgroundColor: '#fff', color: '#374151' }
                  }
                >
                  {tx.no}
                </button>
              </div>
            </div>

            {/* Remaining colli input */}
            {r.isDone === false && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-800 block">{tx.remainingLabel}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={conflict.colliCount - 1}
                    value={r.remainingColli}
                    onChange={(e) => setRemainingColli(conflict.taskId, e.target.value)}
                    placeholder={tx.remainingPlaceholder}
                    className="w-32 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <span className="text-sm text-gray-500">
                    {tx.of} {conflict.colliCount} {tx.colliLeft}
                  </span>
                </div>
                {validRemaining && (
                  <p className="text-xs rounded-xl px-3 py-2.5" style={{ backgroundColor: '#544CA9' + '10', color: '#544CA9' }}>
                    {tx.autoNote(remaining, getDepartmentLabel(conflict.department, lang))}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="flex gap-3 pt-1">
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting} fullWidth size="lg">
          {tx.continue}
        </Button>
        <Button variant="secondary" onClick={onCancel} size="lg" disabled={submitting}>
          {tx.cancel}
        </Button>
      </div>
    </div>
  )
}

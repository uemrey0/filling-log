'use client'

import { useState } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from './Button'
import { getDepartmentLabel } from '@/lib/departments'

export interface ConflictInfo {
  sessionId: string
  taskId: string
  personnelId: string
  personnelName: string
  department: string
  colliCount: number
  expectedMinutes: number
  startedAt: string
}

export interface ConflictResolutionResult {
  personnelId: string
  sessionId: string
  taskId: string
  isDone: boolean
  remainingColli?: number
}

interface ConflictResolutionProps {
  conflicts: ConflictInfo[]
  onResolved: (results: ConflictResolutionResult[]) => void
  onCancel: () => void
}

type Resolution = {
  isDone: boolean | null
  remainingColli: string
}

export function ConflictResolution({ conflicts, onResolved, onCancel }: ConflictResolutionProps) {
  const { lang } = useLanguage()

  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    Object.fromEntries(conflicts.map((c) => [c.sessionId, { isDone: null, remainingColli: '' }])),
  )

  const setIsDone = (sessionId: string, val: boolean) => {
    setResolutions((prev) => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], isDone: val },
    }))
  }

  const setRemainingColli = (sessionId: string, val: string) => {
    setResolutions((prev) => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], remainingColli: val },
    }))
  }

  const canSubmit = conflicts.every((c) => {
    const r = resolutions[c.sessionId]
    if (r.isDone === null) return false
    if (!r.isDone) {
      const n = Number(r.remainingColli)
      if (!r.remainingColli || isNaN(n) || n < 1 || n >= c.colliCount) return false
    }
    return true
  })

  const handleSubmit = () => {
    const results: ConflictResolutionResult[] = conflicts.map((c) => {
      const r = resolutions[c.sessionId]
      return {
        personnelId: c.personnelId,
        sessionId: c.sessionId,
        taskId: c.taskId,
        isDone: r.isDone!,
        remainingColli: !r.isDone ? Number(r.remainingColli) : undefined,
      }
    })
    onResolved(results)
  }

  const texts = {
    nl: {
      title: 'Vorige taak afsluiten',
      subtitle: 'Controleer de voortgang voor je doorgaat',
      taskDone: 'Container volledig afgerond?',
      yes: 'Ja, volledig klaar',
      no: 'Nee, nog niet klaar',
      remainingLabel: 'Hoeveel colli zijn er nog over?',
      remainingPlaceholder: 'Aantal colli',
      of: 'van',
      colliLeft: 'colli totaal',
      continue: 'Doorgaan',
      cancel: 'Annuleren',
      autoNote: (remaining: number, dept: string) =>
        `Er wordt automatisch een nieuwe taak van ${remaining} colli aangemaakt voor de andere medewerker(s) in ${dept}.`,
    },
    en: {
      title: 'Close previous task',
      subtitle: 'Check progress before continuing',
      taskDone: 'Container fully completed?',
      yes: 'Yes, fully done',
      no: 'No, not yet done',
      remainingLabel: 'How many colli are remaining?',
      remainingPlaceholder: 'Colli count',
      of: 'of',
      colliLeft: 'colli total',
      continue: 'Continue',
      cancel: 'Cancel',
      autoNote: (remaining: number, dept: string) =>
        `A new ${remaining} colli task will be automatically created for the other worker(s) in ${dept}.`,
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
        const r = resolutions[conflict.sessionId]
        const remaining = Number(r.remainingColli)
        const validRemaining = !isNaN(remaining) && remaining >= 1 && remaining < conflict.colliCount

        return (
          <div
            key={conflict.sessionId}
            className="rounded-xl border-2 p-4 space-y-4"
            style={{ borderColor: '#80BC17' + '40', backgroundColor: '#80BC17' + '05' }}
          >
            {/* Person + task info */}
            <div className="flex items-start gap-3">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5"
                style={{ backgroundColor: '#80BC17' + '25', color: '#1C7745' }}
              >
                {conflict.personnelName.charAt(0).toUpperCase()}
              </span>
              <div>
                <div className="font-semibold text-black">{conflict.personnelName}</div>
                <div className="text-sm text-gray-600">
                  {getDepartmentLabel(conflict.department, lang)} · {conflict.colliCount} colli · {conflict.expectedMinutes}m verwacht
                </div>
              </div>
            </div>

            {/* Is done question */}
            <div>
              <div className="text-sm font-semibold text-gray-800 mb-2">{tx.taskDone}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDone(conflict.sessionId, true)}
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
                  onClick={() => setIsDone(conflict.sessionId, false)}
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

            {/* Remaining colli (only when not done) */}
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
                    onChange={(e) => setRemainingColli(conflict.sessionId, e.target.value)}
                    placeholder={tx.remainingPlaceholder}
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <span className="text-sm text-gray-500">
                    {tx.of} {conflict.colliCount} {tx.colliLeft}
                  </span>
                </div>
                {validRemaining && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#544CA9' + '10', color: '#544CA9' }}>
                    {tx.autoNote(remaining, getDepartmentLabel(conflict.department, lang))}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="flex gap-3 pt-1">
        <Button onClick={handleSubmit} disabled={!canSubmit} fullWidth size="lg">
          {tx.continue}
        </Button>
        <Button variant="secondary" onClick={onCancel} size="lg">
          {tx.cancel}
        </Button>
      </div>
    </div>
  )
}

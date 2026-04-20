'use client'

import { useMemo, useState } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from './Button'
import { getDepartmentLabel } from '@/lib/departments'
import { calcExpectedMinutes, formatTime } from '@/lib/business'

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

type Choice = 'full' | 'partial' | null

type Resolution = {
  choice: Choice
  remaining: string
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function ConflictResolution({ conflicts, onResolved, onCancel, submitting = false }: ConflictResolutionProps) {
  const { lang } = useLanguage()
  const total = conflicts.length

  const [step, setStep] = useState(1)
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    () => Object.fromEntries(conflicts.map((c) => [c.taskId, { choice: null, remaining: '' }])),
  )

  const copy = lang === 'nl'
    ? {
        title: 'Lopende taak afsluiten',
        subtitle: (total: number) => total > 1
          ? `Er zijn ${total} actieve taken die eerst afgesloten moeten worden`
          : 'Er is al een actieve taak die eerst afgesloten moet worden',
        stepOf: (n: number, m: number) => `Taak ${n} van ${m}`,
        startedAt: 'Gestart',
        colliTotal: 'colli',
        q: 'Is deze taak volledig afgerond?',
        opt1: 'Ja, helemaal klaar',
        opt2: 'Nee, er blijft over',
        remainingLabel: 'Aantal colli dat overblijft',
        ofTotal: (total: number) => `van ${total}`,
        doneLabel: 'Afgerond',
        invalidRange: (max: number) => `Voer een getal in tussen 1 en ${max}`,
        colli: 'colli',
        cancel: 'Annuleren',
        back: 'Terug',
        next: 'Volgende',
        finish: 'Bevestigen',
      }
    : {
        title: 'Close active task',
        subtitle: (total: number) => total > 1
          ? `There are ${total} active tasks to close first`
          : 'There is already an active task to close first',
        stepOf: (n: number, m: number) => `Task ${n} of ${m}`,
        startedAt: 'Started',
        colliTotal: 'colli',
        q: 'Is this task fully done?',
        opt1: 'Yes, fully done',
        opt2: 'No, some colli left',
        remainingLabel: 'Colli remaining',
        ofTotal: (total: number) => `of ${total}`,
        doneLabel: 'Completed',
        invalidRange: (max: number) => `Enter a number between 1 and ${max}`,
        colli: 'colli',
        cancel: 'Cancel',
        back: 'Back',
        next: 'Continue',
        finish: 'Confirm',
      }

  const current = conflicts[step - 1]
  const currentRes = current ? resolutions[current.taskId] : { choice: null as Choice, remaining: '' }

  const setChoice = (taskId: string, choice: Choice) => {
    setResolutions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], choice } }))
  }
  const setRemaining = (taskId: string, val: string) => {
    setResolutions((prev) => ({ ...prev, [taskId]: { ...prev[taskId], remaining: val } }))
  }

  const remainingNumber = Number(currentRes.remaining)
  const remainingValid = currentRes.choice === 'full'
    ? true
    : Number.isFinite(remainingNumber)
      && Number.isInteger(remainingNumber)
      && remainingNumber > 0
      && current !== undefined
      && remainingNumber < current.colliCount

  const doneColli = current && currentRes.choice === 'partial' && remainingValid
    ? current.colliCount - remainingNumber
    : current?.colliCount ?? 0
  const personnelCount = Math.max(1, current?.sessions.length ?? 1)
  const newExpected = useMemo(
    () => calcExpectedMinutes(doneColli, personnelCount),
    [doneColli, personnelCount],
  )

  const canAdvance = currentRes.choice !== null && remainingValid
  const isLast = step === total

  const goNext = () => {
    if (!canAdvance) return
    if (isLast) {
      const results: ConflictResolutionResult[] = conflicts.map((c) => {
        const r = resolutions[c.taskId]
        return {
          taskId: c.taskId,
          isDone: r.choice === 'full',
          remainingColli: r.choice === 'partial' ? Number(r.remaining) : undefined,
        }
      })
      onResolved(results)
    } else {
      setStep((s) => s + 1)
    }
  }

  const goBack = () => {
    if (step === 1) {
      onCancel()
    } else {
      setStep((s) => s - 1)
    }
  }

  const pickFull = (taskId: string) => {
    setResolutions((prev) => ({ ...prev, [taskId]: { choice: 'full', remaining: '' } }))
    if (!isLast) {
      setStep((s) => s + 1)
    }
  }

  if (!current) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-snug">{copy.title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{copy.subtitle(total)}</p>
        </div>
        {total > 1 && (
          <div
            className="flex items-center gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={step}
          >
            {conflicts.map((c, i) => (
              <span
                key={c.taskId}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 === step
                    ? 'w-10 bg-primary'
                    : i + 1 < step
                      ? 'w-6 bg-primary'
                      : 'w-6 bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {total > 1 && (
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {copy.stepOf(step, total)}
          </div>
        )}

        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {getDepartmentLabel(current.department, lang)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 tabular-nums">
                {copy.startedAt}: {formatTime(current.startedAt)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold text-gray-900 tabular-nums">
                {current.colliCount} {copy.colliTotal}
              </div>
              <div className="text-xs text-gray-500 tabular-nums">{current.expectedMinutes}m</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {current.sessions.map((s) => (
              <div
                key={s.sessionId}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-2 py-1"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: '#80BC17' + '25', color: '#1C7745' }}
                >
                  {initials(s.personnelName)}
                </span>
                <span className="text-xs font-medium text-gray-700">{s.personnelName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900">{copy.q}</h3>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => pickFull(current.taskId)}
              className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                currentRes.choice === 'full'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    currentRes.choice === 'full' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-semibold text-sm text-gray-900">{copy.opt1}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setChoice(current.taskId, 'partial')}
              className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                currentRes.choice === 'partial'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    currentRes.choice === 'partial' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                  </svg>
                </div>
                <span className="font-semibold text-sm text-gray-900">{copy.opt2}</span>
              </div>
            </button>
          </div>

          {currentRes.choice === 'partial' && (
            <div className="pt-1">
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">{copy.remainingLabel}</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  value={currentRes.remaining}
                  onChange={(e) => setRemaining(current.taskId, e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-4 pr-16 py-3 text-xl font-bold tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium tabular-nums">
                  {copy.ofTotal(current.colliCount)}
                </span>
              </div>
              {currentRes.remaining && !remainingValid ? (
                <p className="text-xs text-red-500 mt-1.5">{copy.invalidRange(current.colliCount - 1)}</p>
              ) : currentRes.remaining && remainingValid ? (
                <p className="text-xs text-gray-500 mt-1.5 tabular-nums">
                  {copy.doneLabel}: <span className="font-semibold text-gray-700">{doneColli} {copy.colli}</span>
                  <span className="text-gray-300 mx-1.5">·</span>
                  <span className="tabular-nums">{newExpected}m</span>
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button
          variant="secondary"
          onClick={goBack}
          disabled={submitting}
          className="flex-1"
        >
          {step === 1 ? copy.cancel : copy.back}
        </Button>
        <Button
          onClick={goNext}
          disabled={!canAdvance || submitting}
          loading={isLast ? submitting : false}
          className="flex-1"
        >
          {isLast ? copy.finish : copy.next}
        </Button>
      </div>
    </div>
  )
}

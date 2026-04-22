'use client'

import { useMemo, useState } from 'react'
import { ModalOrSheet } from './ModalOrSheet'
import { Button } from './Button'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { calcExpectedMinutes, formatTime } from '@/lib/business'

type Step = 1 | 2 | 3
type Choice = 'full' | 'partial' | null

export interface EndTaskPersonnel {
  sessionId: string
  personnelId: string
  personnelName: string
  startedAt: string
}

export interface EndTaskConfirmData {
  endedAt: string
  remainingColli?: number
  sessionEnds?: { sessionId: string; endedAt: string }[]
  continuingPersonnelIds?: string[]
}

interface EndTaskModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: EndTaskConfirmData) => Promise<void> | void
  task: {
    colliCount: number
    discountContainer: boolean
    startedAt: string
    personnel: EndTaskPersonnel[]
  } | null
  loading?: boolean
}

function currentTimeValue(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function timeStringToIso(time: string): string {
  const [hh, mm] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0)
  return d.toISOString()
}

function isTimeAfter(time: string, referenceIso: string): boolean {
  const iso = timeStringToIso(time)
  return new Date(iso).getTime() > new Date(referenceIso).getTime()
}

export function EndTaskModal({ open, onClose, onConfirm, task, loading = false }: EndTaskModalProps) {
  const { lang } = useLanguage()
  const personnel = task?.personnel ?? []
  const isGroup = personnel.length > 1

  const [step, setStep] = useState<Step>(1)
  const [choice, setChoice] = useState<Choice>(null)
  const [remaining, setRemaining] = useState('')
  const [endTime, setEndTime] = useState(currentTimeValue())
  const [endingIds, setEndingIds] = useState<Set<string>>(new Set())
  const [perPersonTimes, setPerPersonTimes] = useState<Record<string, string>>({})
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setStep(1)
      setChoice(null)
      setRemaining('')
      setEndTime(currentTimeValue())
      setEndingIds(new Set(personnel.map((p) => p.personnelId)))
      const now = currentTimeValue()
      const map: Record<string, string> = {}
      for (const p of personnel) map[p.personnelId] = now
      setPerPersonTimes(map)
    }
  }

  const copy = lang === 'nl'
    ? {
        title: 'Taak beëindigen',
        q1: 'Is de container volledig klaar?',
        opt1: 'Ja, helemaal klaar',
        opt2: 'Nee, er blijft over',
        remainingLabel: 'Aantal colli dat overblijft',
        ofTotal: (total: number) => `van ${total}`,
        doneLabel: 'Afgerond',
        invalidRange: (max: number) => `Voer een getal in tussen 1 en ${max}`,
        q2: 'Wanneer is de taak beëindigd?',
        q2Personnel: 'Wie beëindigt de taak?',
        q2PersonnelHint: 'Wie niet geselecteerd is, krijgt automatisch een nieuwe taak voor de resterende colli.',
        q3PerPerson: 'Eindtijd per persoon',
        continuingHeader: (count: number) => `${count} persoon gaat verder in een nieuwe taak`,
        continuingHeaderPlural: (count: number) => `${count} personen gaan verder in een nieuwe taak`,
        now: 'Nu',
        startedAt: 'Gestart',
        cancel: 'Annuleren',
        back: 'Terug',
        next: 'Volgende',
        finish: 'Beëindigen',
        colli: 'colli',
        selectAtLeastOne: 'Selecteer minimaal één persoon',
        timeBeforeStart: 'Eindtijd moet na starttijd liggen',
      }
    : {
        title: 'End task',
        q1: 'Is the container fully done?',
        opt1: 'Yes, fully done',
        opt2: 'No, some colli left',
        remainingLabel: 'Colli remaining',
        ofTotal: (total: number) => `of ${total}`,
        doneLabel: 'Completed',
        invalidRange: (max: number) => `Enter a number between 1 and ${max}`,
        q2: 'When did the task end?',
        q2Personnel: 'Who is ending the task?',
        q2PersonnelHint: 'Anyone not selected will automatically get a new task for the remaining colli.',
        q3PerPerson: 'End time per person',
        continuingHeader: (count: number) => `${count} person will continue in a new task`,
        continuingHeaderPlural: (count: number) => `${count} people will continue in a new task`,
        now: 'Now',
        startedAt: 'Started',
        cancel: 'Cancel',
        back: 'Back',
        next: 'Continue',
        finish: 'End task',
        colli: 'colli',
        selectAtLeastOne: 'Select at least one person',
        timeBeforeStart: 'End time must be after start time',
      }

  const total = task?.colliCount ?? 0
  const remainingNumber = Number(remaining)
  const remainingValid = choice === 'full'
    ? true
    : Number.isFinite(remainingNumber)
      && Number.isInteger(remainingNumber)
      && remainingNumber > 0
      && remainingNumber < total

  const doneColli = choice === 'partial' && remainingValid ? total - remainingNumber : total

  const endingPersonnel = personnel.filter((p) => endingIds.has(p.personnelId))
  const continuingPersonnel = personnel.filter((p) => !endingIds.has(p.personnelId))

  const newExpected = useMemo(
    () => calcExpectedMinutes(
      doneColli,
      Math.max(1, endingPersonnel.length || personnel.length),
      task?.discountContainer ?? false,
    ),
    [doneColli, endingPersonnel.length, personnel.length, task?.discountContainer],
  )

  // Per-step validity
  const step1Valid = choice !== null && remainingValid

  const showPersonnelStep = isGroup && choice === 'partial'
  const step2PersonnelValid = endingIds.size >= 1

  // Final time step validity
  const allPerPersonTimesValid = endingPersonnel.every((p) => {
    const t = perPersonTimes[p.personnelId]
    return t && t.length > 0 && isTimeAfter(t, p.startedAt)
  })
  const singleTimeValid = endTime.length > 0 && (task ? isTimeAfter(endTime, task.startedAt) : true)

  const usePerPersonTimes = showPersonnelStep
  const canFinish = usePerPersonTimes ? allPerPersonTimesValid && !loading : singleTimeValid && !loading

  const totalSteps = showPersonnelStep ? 3 : 2

  const goNextFromStep1 = () => {
    if (!step1Valid) return
    setStep(2)
  }

  const goNextFromPersonnelStep = () => {
    if (!step2PersonnelValid) return
    setStep(3)
  }

  const handleConfirm = async () => {
    if (usePerPersonTimes) {
      const sessionEnds = endingPersonnel.map((p) => ({
        sessionId: p.sessionId,
        endedAt: timeStringToIso(perPersonTimes[p.personnelId]),
      }))
      const latest = sessionEnds.reduce<string>(
        (acc, s) => (new Date(s.endedAt).getTime() > new Date(acc).getTime() ? s.endedAt : acc),
        sessionEnds[0]?.endedAt ?? new Date().toISOString(),
      )
      await onConfirm({
        endedAt: latest,
        remainingColli: remainingNumber,
        sessionEnds,
        continuingPersonnelIds: continuingPersonnel.map((p) => p.personnelId),
      })
    } else {
      await onConfirm({
        endedAt: timeStringToIso(endTime),
        remainingColli: choice === 'partial' && remainingValid ? remainingNumber : undefined,
      })
    }
  }

  return (
    <ModalOrSheet open={open} onClose={loading ? undefined : onClose}>
      {task && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-gray-900 leading-snug">{copy.title}</h2>
            <div className="flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step}>
              {Array.from({ length: totalSteps }).map((_, idx) => {
                const n = (idx + 1) as Step
                const active = step === n
                return (
                  <span
                    key={`step-seg-${idx}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      active ? 'w-10 bg-primary' : n < step ? 'w-6 bg-primary' : 'w-6 bg-gray-200'
                    }`}
                  />
                )
              })}
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900">{copy.q1}</h3>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setChoice('full')
                    setRemaining('')
                    setStep(2)
                  }}
                  className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                    choice === 'full'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        choice === 'full' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
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
                  onClick={() => setChoice('partial')}
                  className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                    choice === 'partial'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        choice === 'partial' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
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

              {choice === 'partial' && (
                <div className="pt-1">
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">{copy.remainingLabel}</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoFocus
                      value={remaining}
                      onChange={(e) => setRemaining(e.target.value.replace(/\D/g, ''))}
                      placeholder="0"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-4 pr-16 py-3 text-xl font-bold tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium tabular-nums">
                      {copy.ofTotal(total)}
                    </span>
                  </div>
                  {remaining && !remainingValid ? (
                    <p className="text-xs text-red-500 mt-1.5">{copy.invalidRange(total - 1)}</p>
                  ) : remaining && remainingValid ? (
                    <p className="text-xs text-gray-500 mt-1.5 tabular-nums">
                      {copy.doneLabel}: <span className="font-semibold text-gray-700">{doneColli} {copy.colli}</span>
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span className="tabular-nums">{newExpected}m</span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : step === 2 && showPersonnelStep ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{copy.q2Personnel}</h3>
                <p className="text-xs text-gray-500 mt-1">{copy.q2PersonnelHint}</p>
              </div>

              <div className="space-y-2">
                {personnel.map((p) => {
                  const selected = endingIds.has(p.personnelId)
                  return (
                    <button
                      key={p.personnelId}
                      type="button"
                      onClick={() => {
                        setEndingIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(p.personnelId)) next.delete(p.personnelId)
                          else next.add(p.personnelId)
                          return next
                        })
                      }}
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            selected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-300 border border-gray-200'
                          }`}
                        >
                          {selected && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 truncate">{p.personnelName}</div>
                          <div className="text-xs text-gray-400 tabular-nums">
                            {copy.startedAt}: {formatTime(p.startedAt)}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {endingIds.size === 0 ? (
                <p className="text-xs text-red-500">{copy.selectAtLeastOne}</p>
              ) : continuingPersonnel.length > 0 ? (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-gray-700">
                  {continuingPersonnel.length === 1
                    ? copy.continuingHeader(continuingPersonnel.length)
                    : copy.continuingHeaderPlural(continuingPersonnel.length)}
                  <span className="text-gray-400">
                    {' · '}
                    <span className="tabular-nums">{remainingNumber} {copy.colli}</span>
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            // Time step (step 2 without personnel step, or step 3 with it)
            <div className="space-y-4">
              {usePerPersonTimes ? (
                <>
                  <h3 className="text-base font-semibold text-gray-900">{copy.q3PerPerson}</h3>
                  <div className="space-y-2.5">
                    {endingPersonnel.map((p) => {
                      const value = perPersonTimes[p.personnelId] ?? ''
                      const valid = value.length > 0 && isTimeAfter(value, p.startedAt)
                      return (
                        <div key={p.personnelId} className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm text-gray-900 truncate">{p.personnelName}</span>
                            <span className="text-[10px] text-gray-400 tabular-nums">
                              {copy.startedAt}: {formatTime(p.startedAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={value}
                              onChange={(e) =>
                                setPerPersonTimes((prev) => ({ ...prev, [p.personnelId]: e.target.value }))
                              }
                              className={`flex-1 bg-white rounded-lg border px-3 py-2 text-xl font-bold font-mono tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary ${
                                value && !valid ? 'border-red-300' : 'border-gray-200'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPerPersonTimes((prev) => ({ ...prev, [p.personnelId]: currentTimeValue() }))
                              }
                              className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-3 py-1.5 hover:bg-primary/20 transition-colors shrink-0"
                            >
                              {copy.now}
                            </button>
                          </div>
                          {value && !valid && (
                            <p className="text-xs text-red-500 mt-1">{copy.timeBeforeStart}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {continuingPersonnel.length > 0 && (
                    <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-gray-700">
                      {continuingPersonnel.length === 1
                        ? copy.continuingHeader(continuingPersonnel.length)
                        : copy.continuingHeaderPlural(continuingPersonnel.length)}
                      <span className="text-gray-400">
                        {' · '}
                        <span className="tabular-nums">{remainingNumber} {copy.colli}</span>
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-gray-900">{copy.q2}</h3>
                  <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 flex items-center gap-3">
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="flex-1 bg-transparent text-3xl font-bold font-mono tabular-nums text-gray-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEndTime(currentTimeValue())}
                      className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-3 py-1.5 hover:bg-primary/20 transition-colors shrink-0"
                    >
                      {copy.now}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                    <span className="tabular-nums">
                      {copy.startedAt}: {formatTime(task.startedAt)}
                    </span>
                    {choice === 'partial' && remainingValid && (
                      <span className="tabular-nums">
                        {doneColli} / {total} {copy.colli}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {step === 1 ? (
              <>
                <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
                  {copy.cancel}
                </Button>
                <Button onClick={goNextFromStep1} disabled={!step1Valid || loading} className="flex-1">
                  {copy.next}
                </Button>
              </>
            ) : step === 2 && showPersonnelStep ? (
              <>
                <Button variant="secondary" onClick={() => setStep(1)} disabled={loading} className="flex-1">
                  {copy.back}
                </Button>
                <Button onClick={goNextFromPersonnelStep} disabled={!step2PersonnelValid || loading} className="flex-1">
                  {copy.next}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setStep(showPersonnelStep ? 2 : 1)}
                  disabled={loading}
                  className="flex-1"
                >
                  {copy.back}
                </Button>
                <Button variant="danger" onClick={handleConfirm} loading={loading} disabled={!canFinish} className="flex-1">
                  {copy.finish}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </ModalOrSheet>
  )
}

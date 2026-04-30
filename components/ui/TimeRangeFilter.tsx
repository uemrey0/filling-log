'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ModalOrSheet } from '@/components/ui/ModalOrSheet'
import type { TimePreset } from '@/lib/timeRange'

interface PresetOption {
  key: TimePreset
  label: string
}

interface TimeRangeFilterProps {
  title: string
  filterLabel: string
  applyLabel: string
  secondaryLabel: string
  dateFromLabel: string
  dateToLabel: string
  presets: PresetOption[]
  appliedPreset: TimePreset
  pendingPreset: TimePreset
  appliedLabel: string
  dateFrom: string
  dateTo: string
  canApply?: boolean
  showQuickPresets?: boolean
  onOpen?: () => void
  onQuickSelect: (preset: TimePreset) => void
  onPendingPresetChange: (preset: TimePreset) => void
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onApply: () => void
  onSecondaryAction: () => void
}

export function TimeRangeFilter({
  title,
  filterLabel,
  applyLabel,
  secondaryLabel,
  dateFromLabel,
  dateToLabel,
  presets,
  appliedPreset,
  pendingPreset,
  appliedLabel,
  dateFrom,
  dateTo,
  canApply = true,
  showQuickPresets = true,
  onOpen,
  onQuickSelect,
  onPendingPresetChange,
  onDateFromChange,
  onDateToChange,
  onApply,
  onSecondaryAction,
}: TimeRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const customOption = presets.find((preset) => preset.key === 'custom')
  const quickPresets = presets.filter((preset) => preset.key !== 'custom')

  const openFilters = () => {
    onOpen?.()
    setOpen(true)
  }

  const closeFilters = () => {
    setOpen(false)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`${showQuickPresets ? 'hidden sm:flex' : 'hidden'} min-w-0 flex-1 items-center gap-2 overflow-x-auto no-scrollbar pb-0.5`}>
          <div className="flex gap-2">
            {quickPresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => onQuickSelect(preset.key)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
                style={
                  appliedPreset === preset.key
                    ? { backgroundColor: '#80BC17', color: '#fff' }
                    : { backgroundColor: '#F3F4F6', color: '#374151' }
                }
              >
                {preset.label}
              </button>
            ))}
            {customOption && (
              <button
                type="button"
                onClick={openFilters}
                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
                style={
                  appliedPreset === 'custom'
                    ? { backgroundColor: '#80BC17', color: '#fff' }
                    : { backgroundColor: '#F3F4F6', color: '#374151' }
                }
              >
                {customOption.label}
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={openFilters}
          aria-label={`${filterLabel}: ${appliedLabel}`}
          className="ml-auto inline-flex max-w-full items-center gap-2 rounded-full border border-transparent bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-200 hover:bg-white hover:text-gray-800 transition-colors flex-shrink-0"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <span className="sr-only">{filterLabel}</span>
            <span className="truncate">{appliedLabel}</span>
          </span>
          <span className="text-gray-300">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
      </div>

      <ModalOrSheet open={open} onClose={closeFilters}>
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => onPendingPresetChange(preset.key)}
                className="py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={
                  pendingPreset === preset.key
                    ? { backgroundColor: '#80BC17', color: '#fff' }
                    : { backgroundColor: '#F3F4F6', color: '#374151' }
                }
              >
                {preset.label}
              </button>
            ))}
          </div>

          {pendingPreset === 'custom' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">{dateFromLabel}</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => onDateFromChange(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">{dateToLabel}</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => onDateToChange(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => {
                onApply()
                closeFilters()
              }}
              className="flex-1"
              disabled={!canApply}
            >
              {applyLabel}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onSecondaryAction()
                closeFilters()
              }}
              className="flex-1"
            >
              {secondaryLabel}
            </Button>
          </div>
        </div>
      </ModalOrSheet>
    </>
  )
}

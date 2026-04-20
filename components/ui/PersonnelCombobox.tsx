'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import type { Personnel } from '@/lib/db/schema'

export interface PersonnelChip {
  id: string
  fullName: string
}

interface PersonnelComboboxProps {
  personnel: Personnel[]
  selected: PersonnelChip[]
  onSelect: (person: PersonnelChip) => void
  onRemove: (id: string) => void
  onAddNew: (name: string) => Promise<PersonnelChip>
  label: string
  error?: string
}

export function PersonnelCombobox({
  personnel,
  selected,
  onSelect,
  onRemove,
  onAddNew,
  label,
  error,
}: PersonnelComboboxProps) {
  const { lang } = useLanguage()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedIds = new Set(selected.map((s) => s.id))

  const filtered = query.trim()
    ? personnel.filter(
        (p) =>
          !selectedIds.has(p.id) &&
          p.fullName.toLowerCase().includes(query.toLowerCase()),
      )
    : personnel.filter((p) => !selectedIds.has(p.id))

  const canAddNew =
    query.trim().length >= 2 &&
    !personnel.some((p) => p.fullName.toLowerCase() === query.toLowerCase())

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (person: Personnel) => {
    onSelect({ id: person.id, fullName: person.fullName })
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleAddNew = async () => {
    if (!query.trim() || adding) return
    setAdding(true)
    try {
      const newPerson = await onAddNew(query.trim())
      onSelect(newPerson)
      setQuery('')
      setOpen(false)
    } finally {
      setAdding(false)
    }
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      onRemove(selected[selected.length - 1].id)
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length === 1) {
        handleSelect(filtered[0])
      } else if (filtered.length === 0 && canAddNew) {
        handleAddNew()
      }
    }
  }

  const addLabel = lang === 'nl' ? 'Toevoegen' : 'Add'
  const searchPlaceholder =
    selected.length === 0
      ? lang === 'nl'
        ? 'Zoek of voeg personeel toe...'
        : 'Search or add personnel...'
      : lang === 'nl'
      ? 'Meer toevoegen...'
      : 'Add more...'

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-900">{label}</label>

      {/* Input box with chips */}
      <div
        className={`min-h-[48px] w-full rounded-lg border bg-white px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-text transition-colors ${
          error
            ? 'border-accent-red ring-1 ring-accent-red'
            : open
            ? 'border-primary ring-2 ring-primary ring-offset-0'
            : 'border-gray-300'
        }`}
        onClick={() => {
          inputRef.current?.focus()
          setOpen(true)
        }}
      >
        {selected.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-md text-sm font-medium"
            style={{ backgroundColor: '#80BC17' + '20', color: '#1C7745' }}
          >
            {chip.fullName}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(chip.id)
              }}
              className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
              aria-label="Remove"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder}
          className="flex-1 min-w-[120px] text-base md:text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
        />
      </div>

      {error && <p className="text-xs text-accent-red font-medium">{error}</p>}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 && !canAddNew && (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              {lang === 'nl' ? 'Geen resultaten' : 'No results'}
            </div>
          )}

          {filtered.map((person) => (
            <button
              key={person.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(person)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-sm text-gray-900"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: '#80BC17' + '20', color: '#1C7745' }}
              >
                {person.fullName.charAt(0).toUpperCase()}
              </span>
              {person.fullName}
            </button>
          ))}

          {canAddNew && (
            <>
              {filtered.length > 0 && <div className="border-t border-gray-100" />}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddNew}
                disabled={adding}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors text-sm font-medium"
                style={{ color: '#544CA9' }}
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#544CA9' + '15' }}
                >
                  {adding ? (
                    <span
                      className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                    />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </span>
                {addLabel} &ldquo;{query.trim()}&rdquo;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

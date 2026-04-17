'use client'

import { useState, useRef, useEffect } from 'react'

interface PersonnelSearchSelectProps {
  personnel: Array<{ id: string; fullName: string }>
  value: string
  onChange: (id: string) => void
  label?: string
  placeholder?: string
  allLabel?: string
}

export function PersonnelSearchSelect({
  personnel,
  value,
  onChange,
  label,
  placeholder,
  allLabel,
}: PersonnelSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = personnel.find((p) => p.id === value)

  const filtered = query.trim()
    ? personnel.filter((p) => p.fullName.toLowerCase().includes(query.toLowerCase()))
    : personnel

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSelect = (person: { id: string; fullName: string }) => {
    onChange(person.id)
    setQuery('')
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="text-xs font-medium text-gray-600 mb-1.5 block">{label}</label>}

      <div
        className={`flex items-center gap-2 w-full rounded-xl border bg-gray-50 px-3 py-2.5 cursor-text transition-colors ${
          open
            ? 'border-primary ring-2 ring-primary ring-offset-0 bg-white'
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={handleOpen}
      >
        {open ? (
          <>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder ?? (selected ? selected.fullName : (allLabel ?? 'Zoek...'))}
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none min-w-0"
            />
          </>
        ) : selected ? (
          <>
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: '#80BC17' + '25', color: '#1C7745' }}
            >
              {selected.fullName.charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 text-sm text-gray-900 truncate">{selected.fullName}</span>
            <button
              type="button"
              onClick={handleClear}
              className="w-4 h-4 text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="flex-1 text-sm text-gray-400">{allLabel ?? 'Alle medewerkers'}</span>
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {allLabel && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                !value ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              {allLabel}
            </button>
          )}

          {filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">Geen resultaten</div>
          )}

          {filtered.map((person) => (
            <button
              key={person.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(person)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                person.id === value ? 'bg-[#80BC17]/10 font-medium' : 'hover:bg-gray-50'
              }`}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: '#80BC17' + '20', color: '#1C7745' }}
              >
                {person.fullName.charAt(0).toUpperCase()}
              </span>
              <span className="text-gray-900">{person.fullName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

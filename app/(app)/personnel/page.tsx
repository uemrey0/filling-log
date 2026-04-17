'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Personnel } from '@/lib/db/schema'

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function PersonnelPage() {
  const { t } = useLanguage()
  const [people, setPeople] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/personnel')
      if (res.ok) setPeople(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActive = async (e: React.MouseEvent, person: Personnel) => {
    e.preventDefault()
    e.stopPropagation()
    setTogglingId(person.id)
    try {
      if (person.isActive) {
        await fetch(`/api/personnel/${person.id}`, { method: 'DELETE' })
      } else {
        await fetch(`/api/personnel/${person.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: person.fullName, isActive: true, notes: person.notes }),
        })
      }
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  const active = people.filter((p) => p.isActive)
  const inactive = people.filter((p) => !p.isActive)

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('personnel.title')}
        action={
          <Link href="/personnel/new">
            <Button size="md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {t('personnel.addNew')}
            </Button>
          </Link>
        }
      />

      {people.length === 0 ? (
        <Card>
          <EmptyState
            title={t('personnel.noPersonnel')}
            description={t('personnel.addFirst')}
            action={
              <Link href="/personnel/new">
                <Button>{t('personnel.addNew')}</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Active */}
          {active.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {t('personnel.active')}
                </h2>
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: '#80BC17' }}
                >
                  {active.length}
                </span>
              </div>
              <div className="space-y-2">
                {active.map((person) => (
                  <Link key={person.id} href={`/personnel/${person.id}`} className="block">
                    <Card padding="sm" className="hover:border-gray-300 transition-colors active:scale-[0.99]">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: '#80BC17' + '20', color: '#1C7745' }}
                        >
                          {initials(person.fullName)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm">{person.fullName}</div>
                          {person.notes && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{person.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={togglingId === person.id}
                            onClick={(e) => toggleActive(e, person)}
                          >
                            {t('personnel.deactivate')}
                          </Button>
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {t('personnel.inactive')}
                </h2>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-[10px] font-bold text-gray-500">
                  {inactive.length}
                </span>
              </div>
              <div className="space-y-2">
                {inactive.map((person) => (
                  <Link key={person.id} href={`/personnel/${person.id}`} className="block">
                    <Card padding="sm" className="hover:border-gray-300 transition-colors opacity-60">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                          {initials(person.fullName)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-700 text-sm">{person.fullName}</div>
                          {person.notes && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{person.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={togglingId === person.id}
                            onClick={(e) => toggleActive(e, person)}
                          >
                            {t('personnel.activate')}
                          </Button>
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

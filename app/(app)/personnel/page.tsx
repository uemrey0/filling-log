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

  const toggleActive = async (person: Personnel) => {
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

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('personnel.title')}
        action={
          <Link href="/personnel/new">
            <Button size="md">{t('personnel.addNew')}</Button>
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
        <div className="space-y-2">
          {people.map((person) => (
            <Card key={person.id} padding="sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{person.fullName}</span>
                    <Badge variant={person.isActive ? 'green' : 'gray'}>
                      {person.isActive ? t('personnel.active') : t('personnel.inactive')}
                    </Badge>
                  </div>
                  {person.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{person.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/personnel/${person.id}/edit`}>
                    <Button variant="ghost" size="sm">{t('common.edit')}</Button>
                  </Link>
                  <Button
                    variant={person.isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    loading={togglingId === person.id}
                    onClick={() => toggleActive(person)}
                  >
                    {person.isActive ? t('personnel.deactivate') : t('personnel.activate')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

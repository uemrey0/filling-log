'use client'

import { useLanguage } from '@/components/providers/LanguageProvider'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Language } from '@/lib/i18n'

export default function SettingsPage() {
  const { t, lang, setLang } = useLanguage()

  const options: { value: Language; label: string; sublabel: string }[] = [
    { value: 'nl', label: t('settings.dutch'), sublabel: 'Nederlands' },
    { value: 'en', label: t('settings.english'), sublabel: 'English' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title={t('settings.title')} />

      <Card padding="md">
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-black">{t('settings.language')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('settings.languageDescription')}</p>
          </div>

          <div className="flex flex-col gap-2">
            {options.map((opt) => {
              const active = lang === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLang(opt.value)}
                  className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl border text-left transition-all"
                  style={
                    active
                      ? {
                          borderColor: '#80BC17',
                          backgroundColor: '#80BC17' + '10',
                        }
                      : {
                          borderColor: '#E5E7EB',
                          backgroundColor: '#ffffff',
                        }
                  }
                >
                  <div>
                    <div
                      className="font-semibold text-sm"
                      style={{ color: active ? '#1C7745' : '#111827' }}
                    >
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</div>
                  </div>
                  {active && (
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: '#80BC17' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

    </div>
  )
}

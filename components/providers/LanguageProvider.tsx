'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  type Language,
  type TranslationKey,
  type Translations,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  translations,
  getTranslation,
} from '@/lib/i18n'

interface LanguageContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: TranslationKey) => string
  tr: Translations
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(DEFAULT_LANGUAGE)

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null
    if (stored && (stored === 'nl' || stored === 'en')) {
      setLangState(stored)
    }
  }, [])

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
  }, [])

  const t = useCallback(
    (key: TranslationKey) => getTranslation(lang, key),
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tr: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

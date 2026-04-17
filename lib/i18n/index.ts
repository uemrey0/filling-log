import { nl, type Translations } from './locales/nl'
import { en } from './locales/en'

export type Language = 'nl' | 'en'

export const LANGUAGES: Record<Language, string> = {
  nl: 'Nederlands',
  en: 'English',
}

export const DEFAULT_LANGUAGE: Language = 'nl'
export const LANGUAGE_STORAGE_KEY = 'fillerlog_language'

export const translations: Record<Language, Translations> = { nl, en }

type DeepKeys<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? Prefix extends ''
          ? DeepKeys<T[K], K>
          : DeepKeys<T[K], `${Prefix}.${K}`>
        : never
    }[keyof T]
  : Prefix

export type TranslationKey = DeepKeys<Translations>

export function getTranslation(lang: Language, key: TranslationKey): string {
  const parts = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = translations[lang]
  for (const part of parts) {
    value = value?.[part]
  }
  return typeof value === 'string' ? value : key
}

export { nl, en }
export type { Translations }

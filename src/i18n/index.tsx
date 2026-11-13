import React, { createContext, useContext, useEffect, useState } from 'react';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { ja } from './locales/ja';
import type { LocaleBundle, LocaleCode, LocaleMeta, TranslationDictionary } from './types';

/**
 * Central locale registry.
 * To add a new language:
 * 1. Create `src/i18n/locales/<code>.ts` exporting a `LocaleBundle`.
 * 2. Import and register it in `LOCALES` below.
 */
export const LOCALES: Record<string, LocaleBundle> = {
  en,
  ar,
  ja,
};

export const AVAILABLE_LOCALES: LocaleMeta[] = Object.values(LOCALES).map((bundle) => bundle.meta);

export const DEFAULT_LOCALE: LocaleCode = 'en';

interface I18nContextValue {
  locale: LocaleCode;
  meta: LocaleMeta;
  t: TranslationDictionary;
  setLocale: (code: LocaleCode) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function resolveInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang && LOCALES[urlLang]) return urlLang;

  const stored = window.localStorage.getItem('horizonpdf_lang');
  if (stored && LOCALES[stored]) return stored;

  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  if (LOCALES[browserLang]) return browserLang;

  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(resolveInitialLocale);

  const bundle = LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];

  const setLocale = (next: LocaleCode) => {
    if (!LOCALES[next]) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem('horizonpdf_lang', next);
    } catch {
      // Ignore storage errors in restricted iframes
    }
  };

  useEffect(() => {
    document.documentElement.lang = bundle.meta.code;
    document.documentElement.dir = bundle.meta.dir;
  }, [bundle.meta.code, bundle.meta.dir]);

  return (
    <I18nContext.Provider
      value={{
        locale: bundle.meta.code,
        meta: bundle.meta,
        t: bundle.t,
        setLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}

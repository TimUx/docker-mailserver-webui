import { createContext, useContext, useState, type ReactNode } from 'react';
import { en } from './en';
import { de } from './de';
import type { Translations } from './translations';

export type Locale = 'en' | 'de';

const LOCALE_STORAGE_KEY = 'dms-locale';

const locales: Record<Locale, Translations> = { en, de };

function detectLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
  if (saved && saved in locales) return saved;
  const lang = navigator.language.split('-')[0].toLowerCase();
  if (lang in locales) return lang as Locale;
  return 'en';
}

type I18nContextType = {
  t: Translations;
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextType>({
  t: en,
  locale: 'en',
  setLocale: () => undefined,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
  };

  return (
    <I18nContext.Provider value={{ t: locales[locale], locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

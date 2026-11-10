import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Locale } from './locale';

const STORAGE_KEY = 'shiye.language';
const LanguageContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({
  locale: 'zh-CN',
  setLocale: () => {},
});

function initialLocale(): Locale {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'en' || requested === 'zh-CN') return requested;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh-CN') return saved;
  } catch {
    // The language switch still works when browser storage is unavailable.
  }
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'en' ? 'Shiye · TXT ↔ EPUB Converter' : '拾页 · TXT 与 EPUB 互转';
  }, [locale]);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      // Keep the current choice in memory.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('lang', nextLocale);
    window.history.replaceState(window.history.state, '', url);
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale: changeLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
const chinese = (zh: string, _en: string) => zh;
const english = (_zh: string, en: string) => en;
export const useText = () => (useLanguage().locale === 'en' ? english : chinese);

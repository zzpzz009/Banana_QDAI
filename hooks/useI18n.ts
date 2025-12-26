import { useCallback, useState } from 'react';
import { translations } from '@/translations';

export type Language = 'en' | 'zho';

export interface UseI18nResult {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, ...args: unknown[]) => unknown;
}

export function useI18n(): UseI18nResult {
  const [language, setLanguage] = useState<Language>('zho');

  const t = useCallback((key: string, ...args: unknown[]): unknown => {
    const keys = key.split('.');
    let result: unknown = translations[language];
    for (const k of keys) {
      result = (result as Record<string, unknown> | undefined)?.[k];
    }
    if (typeof result === 'function') {
      return (result as (...a: unknown[]) => unknown)(...args);
    }
    return result || key;
  }, [language]);

  return { language, setLanguage, t };
}


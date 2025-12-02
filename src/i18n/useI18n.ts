import { translations } from './translations';

type LangKey = keyof typeof translations;

export function useI18n(lang: LangKey) {
  const dict = translations[lang] || translations.en;
  const t = (key: keyof typeof dict, ...args: unknown[]) => {
    const val = dict[key];
    if (typeof val === 'function') return (val as (...a: unknown[]) => unknown)(...args);
    return val as unknown;
  };
  return { t, dict };
}

/**
 * i18n 语言配置(@lokvis/embed-video 内部副本)。
 *
 * 与 apps/playground/src/i18n/config.ts 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 *
 * 支持语言(6 种):en(英文,默认)/ zh(中文)/ ja(日文)/ es(西班牙文)/ de(德文)/ fr(法文)
 */
export const languages = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
} as const;

export type Language = keyof typeof languages;

export const defaultLang: Language = 'en';

export const langList = Object.keys(languages) as Language[];

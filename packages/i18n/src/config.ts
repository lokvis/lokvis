/**
 * i18n 语言配置(@lokvis/i18n 核心)。
 *
 * 所有消费包(ui-react / embed-image / embed-video / embed-pdf / playground)
 * 统一从此处 re-export，保证 6 语言集合与默认语言唯一来源。
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

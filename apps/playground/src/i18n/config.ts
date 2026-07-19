/**
 * i18n 语言配置
 *
 * 支持语言（6 种）：en（英文，默认）/ zh（中文）/ ja（日文）/ es（西班牙文）/ de（德文）/ fr（法文）
 * 路由策略：路径前缀 /en/ /zh/ /ja/ /es/ /de/ /fr/（astro.config.mjs i18n.prefixDefaultLocale: true）
 *
 * 新语言（ja/es/de/fr）缺失 key 时,t() 自动回退到 en,
 * en 也缺失时返回 key 本身（见 utils.ts）。
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

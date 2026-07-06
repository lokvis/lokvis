/**
 * i18n 语言配置
 *
 * 支持语言：en（英文，默认）+ zh（中文）
 * 路由策略：路径前缀 /en/ /zh/（astro.config.mjs i18n.prefixDefaultLocale: true）
 */
export const languages = {
  en: 'English',
  zh: '中文',
} as const;

export type Language = keyof typeof languages;

export const defaultLang: Language = 'en';

export const langList = Object.keys(languages) as Language[];

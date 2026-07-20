/**
 * i18n 工具函数(@lokvis/quick-image 内部)。
 *
 * Task 2 解耦后,所有翻译函数支持 translations overrides(来自 QuickI18nProvider)。
 * 覆盖优先级:overrides[key][lang] → 包内 ui[key][lang] → ui[key][defaultLang] → key 本身。
 *
 * - getLangFromUrl: 从 URL 路径提取语言(/en/xxx → 'en')
 * - t: 翻译函数,支持 overrides 优先
 * - useTranslations: 创建翻译函数(React 组件用,自动读取 Provider)
 */
import { defaultLang, type Language } from './config';
import { ui } from './ui';
import { useQuickI18nContext, type QuickTranslations } from './QuickI18nProvider';

// re-export 类型,方便外部 import { type Language } from '@lokvis/quick-image'
export type { Language };
// re-export QuickTranslations 供消费方构造 overrides 类型
export type { QuickTranslations };

/** 6 语言列表,用于 URL 路径前缀检测 */
const SUPPORTED_LANGS: ReadonlySet<string> = new Set(['en', 'zh', 'ja', 'es', 'de', 'fr']);

/** 6 语言前缀正则:匹配 /en/ /zh/ /ja/ /es/ /de/ /fr/(路径起始) */
const LANG_PREFIX_RE = /^\/(en|zh|ja|es|de|fr)(?=\/|$)/;

/** 判断字符串是否为受支持的语言代码 */
function isLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGS.has(lang);
}

/** 从 URL 路径提取语言 */
export function getLangFromUrl(url: URL | string): Language {
  let pathname: string;
  if (typeof url === 'string') {
    pathname = url.startsWith('http') || url.startsWith('//') ? new URL(url).pathname : url;
  } else {
    pathname = url.pathname;
  }
  const [, lang] = pathname.split('/');
  if (lang && isLanguage(lang)) return lang;
  return defaultLang;
}

/**
 * 翻译函数:根据 lang + key 返回对应字符串。
 *
 * 优先级:overrides[key][lang] → ui[key][lang] → ui[key][defaultLang] → key 本身
 *
 * @param lang 当前语言
 * @param key 翻译 key(如 'quickCompress.title')
 * @param overrides 消费方注入的翻译覆盖(可选)
 */
export function t(
  lang: Language,
  key: string,
  overrides?: QuickTranslations
): string {
  // 1. 消费方覆盖优先
  const override = overrides?.[key]?.[lang];
  if (override) return override;
  // 2. 包内字典
  return ui[key]?.[lang] ?? ui[key]?.[defaultLang] ?? key;
}

/**
 * 创建翻译函数(React 组件用)。
 *
 * 自动从 QuickI18nProvider 读取 translations 覆盖;无 Provider 时仅用包内字典。
 *
 * @param lang 当前语言(由 useLang 推导)
 */
export function useTranslations(lang: Language) {
  const ctx = useQuickI18nContext();
  const overrides = ctx?.translations;
  return (key: string) => t(lang, key, overrides);
}

/** 获取当前语言下的 URL(在路径前插入 lang 前缀) */
export function localizePath(path: string, lang: Language): string {
  if (LANG_PREFIX_RE.test(path)) {
    return path;
  }
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${lang}${clean}`;
}

/** 获取切换到目标语言后的对应页面 URL */
export function switchLangPath(currentPath: string, targetLang: Language): string {
  const stripped = currentPath.replace(LANG_PREFIX_RE, '') || '/';
  return localizePath(stripped, targetLang);
}

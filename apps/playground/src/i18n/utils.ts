/**
 * i18n 工具函数
 *
 * - getLangFromUrl: 从 URL 路径提取语言（/en/xxx → 'en'）
 * - getLangFromProps: 从 Astro props 提取 lang
 * - t: 翻译函数，根据 lang 返回对应字符串；缺失时回退到 defaultLang（en），再缺失返回 key 本身
 * - useTranslations: 创建翻译函数（React 组件用）
 *
 * 6 语言支持：en / zh / ja / es / de / fr
 * 新语言缺失 key 时通过 fallback 机制自动回退到 en，避免逐个 key 补全 6 语言翻译。
 */
import { defaultLang, type Language } from './config';
import { ui } from './ui';

// re-export 类型，方便外部 import { type Language } from '@/i18n/utils'
export type { Language };

/** 6 语言列表，用于 URL 路径前缀检测 */
const SUPPORTED_LANGS: ReadonlySet<string> = new Set(['en', 'zh', 'ja', 'es', 'de', 'fr']);

/** 6 语言前缀正则：匹配 /en/ /zh/ /ja/ /es/ /de/ /fr/（路径起始） */
const LANG_PREFIX_RE = /^\/(en|zh|ja|es|de|fr)(?=\/|$)/;

/** 判断字符串是否为受支持的语言代码 */
function isLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGS.has(lang);
}

/** 从 URL 路径提取语言（/en/sdk → 'en'，/zh/sdk → 'zh'，未知 → defaultLang）
 *  支持传入 URL 对象、pathname 字符串、或完整 URL 字符串（http://...）
 */
export function getLangFromUrl(url: URL | string): Language {
  let pathname: string;
  if (typeof url === 'string') {
    // 完整 URL 字符串（如 window.location.href）需先解析出 pathname
    pathname = url.startsWith('http') || url.startsWith('//') ? new URL(url).pathname : url;
  } else {
    pathname = url.pathname;
  }
  const [, lang] = pathname.split('/');
  if (lang && isLanguage(lang)) return lang;
  return defaultLang;
}

/** 翻译函数：根据 lang 返回 key 对应的字符串
 *  fallback 链：lang → defaultLang（en） → key 本身
 *  新语言（ja/es/de/fr）缺失翻译时自动回退到 en，避免 UI 出现 key 字面值。 */
export function t(lang: Language, key: string): string {
  return ui[key]?.[lang] ?? ui[key]?.[defaultLang] ?? key;
}

/** 创建翻译函数（React 组件用） */
export function useTranslations(lang: Language) {
  return (key: string) => t(lang, key);
}

/** 获取当前语言下的 URL（在路径前插入 lang 前缀） */
export function localizePath(path: string, lang: Language): string {
  // 已经带语言前缀的不再重复添加
  if (LANG_PREFIX_RE.test(path)) {
    return path;
  }
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${lang}${clean}`;
}

/** 获取切换到目标语言后的对应页面 URL */
export function switchLangPath(currentPath: string, targetLang: Language): string {
  // 移除当前语言前缀
  const stripped = currentPath.replace(LANG_PREFIX_RE, '') || '/';
  return localizePath(stripped, targetLang);
}

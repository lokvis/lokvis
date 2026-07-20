/**
 * i18n 工具函数(@lokvis/quick-image 内部副本)。
 *
 * 与 apps/playground/src/i18n/utils.ts 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 *
 * - getLangFromUrl: 从 URL 路径提取语言(/en/xxx → 'en')
 * - t: 翻译函数,根据 lang 返回对应字符串;缺失时回退到 defaultLang(en),再缺失返回 key 本身
 * - useTranslations: 创建翻译函数(React 组件用)
 */
import { defaultLang, type Language } from './config';
import { ui } from './ui';

// re-export 类型,方便外部 import { type Language } from '@lokvis/quick-image'
export type { Language };

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

/** 翻译函数:根据 lang 返回 key 对应的字符串
 *  fallback 链:lang → defaultLang(en) → key 本身 */
export function t(lang: Language, key: string): string {
  return ui[key]?.[lang] ?? ui[key]?.[defaultLang] ?? key;
}

/** 创建翻译函数(React 组件用) */
export function useTranslations(lang: Language) {
  return (key: string) => t(lang, key);
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

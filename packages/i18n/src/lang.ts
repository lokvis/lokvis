/**
 * 语言判定与 URL/路径处理(@lokvis/i18n 核心)。
 *
 * - isLanguage: 判断字符串是否为受支持语言
 * - getLangFromUrl: 从 URL 路径前缀提取语言(/zh/xxx → 'zh')
 * - localizePath / switchLangPath: 在路径前插入 / 切换 lang 前缀
 */
import { defaultLang, langList, type Language } from './config.js';

const SUPPORTED_LANGS: ReadonlySet<string> = new Set(langList);

/** 语言前缀正则:从 langList 动态构造,匹配 /en/ /zh/ … (路径起始) */
export const LANG_PREFIX_RE = new RegExp(`^/(${langList.join('|')})(?=/|$)`);

/** 判断字符串是否为受支持的语言代码 */
export function isLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGS.has(lang);
}

/** 从 URL 路径提取语言(非语言前缀回退到默认语言) */
export function getLangFromUrl(url: URL | string): Language {
  let pathname: string;
  if (typeof url === 'string') {
    // base 兜底:协议相对 URL(//host/path)无 base 时 new URL 会抛 TypeError
    pathname =
      url.startsWith('http') || url.startsWith('//')
        ? new URL(url, 'http://localhost').pathname
        : url;
  } else {
    pathname = url.pathname;
  }
  const [, lang] = pathname.split('/');
  if (lang && isLanguage(lang)) return lang;
  return defaultLang;
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

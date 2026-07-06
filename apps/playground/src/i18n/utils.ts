/**
 * i18n 工具函数
 *
 * - getLangFromUrl: 从 URL 路径提取语言（/en/xxx → 'en'）
 * - getLangFromProps: 从 Astro props 提取 lang
 * - t: 翻译函数，根据 lang 返回对应字符串
 * - useTranslations: 创建翻译函数（React 组件用）
 */
import { defaultLang, type Language } from './config';
import { ui } from './ui';

// re-export 类型，方便外部 import { type Language } from '@/i18n/utils'
export type { Language };

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
  if (lang === 'en' || lang === 'zh') return lang;
  return defaultLang;
}

/** 翻译函数：根据 lang 返回 key 对应的字符串，缺失时回退到 key 本身 */
export function t(lang: Language, key: string): string {
  return ui[key]?.[lang] ?? key;
}

/** 创建翻译函数（React 组件用） */
export function useTranslations(lang: Language) {
  return (key: string) => t(lang, key);
}

/** 获取当前语言下的 URL（在路径前插入 lang 前缀） */
export function localizePath(path: string, lang: Language): string {
  // 已经带语言前缀的不再重复添加
  if (path.startsWith('/en/') || path.startsWith('/zh/') || path === '/en' || path === '/zh') {
    return path;
  }
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${lang}${clean}`;
}

/** 获取切换到目标语言后的对应页面 URL */
export function switchLangPath(currentPath: string, targetLang: Language): string {
  // 移除当前语言前缀
  const stripped = currentPath.replace(/^\/(en|zh)(?=\/|$)/, '') || '/';
  return localizePath(stripped, targetLang);
}

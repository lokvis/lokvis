/**
 * useLang - React hook,获取当前页面语言(@lokvis/quick-image 内部副本)。
 *
 * 与 apps/playground/src/i18n/useLang.ts 保持一致;
 * 包内独立维护避免与 playground 相互耦合。
 *
 * 优先从 `<html lang>` 属性读取(Astro SSR 已正确设置)。
 *
 * Task 2 将重构为 Provider 模式,允许三方通过 prop / context 注入 locale,
 * 而非依赖 document.documentElement.lang(便于在非浏览器环境或自定义路由下使用)。
 */
import { useState, useEffect } from 'react';
import { getLangFromUrl } from './utils';
import { defaultLang, type Language } from './config';

/** 受支持的 6 语言代码集合,用于 htmlLang 校验 */
const SUPPORTED_HTML_LANGS: ReadonlySet<string> = new Set(['en', 'zh', 'ja', 'es', 'de', 'fr']);

/** 从 document.documentElement.lang 读取语言,回退到 URL 解析 */
function detectLang(): Language {
  if (typeof document === 'undefined') return defaultLang;
  const htmlLang = document.documentElement.lang;
  if (htmlLang && SUPPORTED_HTML_LANGS.has(htmlLang)) {
    return htmlLang as Language;
  }
  return getLangFromUrl(window.location.href);
}

export function useLang(): Language {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') return defaultLang;
    return detectLang();
  });

  useEffect(() => {
    const update = () => setLang(detectLang());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  return lang;
}

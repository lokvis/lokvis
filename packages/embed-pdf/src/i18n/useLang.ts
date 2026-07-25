/**
 * useLang - React hook,获取当前页面语言(@lokvis/embed-pdf 内部)。
 *
 * 优先级链:
 *   1. explicitLocale 参数(组件 locale prop 直接传入,最高优先级)
 *   2. EmbedPdfI18nProvider 注入的 locale(Provider 模式)
 *   3. document.documentElement.lang 检测(浏览器环境)
 *   4. URL 路径前缀解析(回退方案)
 *
 * 监听 popstate 事件以支持 SPA 式导航。
 */
import { useState, useEffect } from 'react';
import { getLangFromUrl } from './utils';
import { defaultLang, type Language } from './config';
import { usePdfI18nContext } from './EmbedPdfI18nProvider';

/** 受支持的 6 语言代码集,用于 htmlLang 校验 */
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

/**
 * 获取当前语言。
 *
 * @param explicitLocale 显式 locale 覆盖(优先级最高,来自 Layer 2 组件 locale prop)
 */
export function useLang(explicitLocale?: Language): Language {
  // Hooks 必须无条件调用(Rules of Hooks),优先级逻辑放在返回值中
  const ctx = usePdfI18nContext();

  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') return defaultLang;
    return detectLang();
  });

  useEffect(() => {
    const update = () => setLang(detectLang());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  // 优先级链:explicitLocale > Provider > 自动检测(html lang → URL)
  if (explicitLocale) return explicitLocale;
  if (ctx?.locale) return ctx.locale;
  return lang;
}

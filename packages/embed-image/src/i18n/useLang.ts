/**
 * useLang - React hook,获取当前页面语言(@lokvis/embed-image 内部)。
 *
 * Task 2 解耦后的优先级链:
 *   1. explicitLocale 参数(组件 locale prop 直接传入,最高优先级)
 *   2. EmbedI18nProvider 注入的 locale(Provider 模式)
 *   3. document.documentElement.lang 检测(浏览器环境,Astro SSR 默认行为)
 *   4. URL 路径前缀解析(回退方案)
 *
 * 三方接入路径:
 *   - 不传参 + 不包 Provider → 走 3/4 自动检测(playground/Astro 兼容)
 *   - 包 <EmbedI18nProvider locale="zh"> → 走 2(SPA 推荐)
 *   - 传 <EmbedImageCompress locale="zh" /> → 走 1(client:only Astro 推荐)
 *
 * 监听 popstate 事件以支持 SPA 式导航(如 View Transitions)。
 */
import { useState, useEffect } from 'react';
import { getLangFromUrl } from './utils';
import { defaultLang, type Language } from './config';
import { useQuickI18nContext } from './EmbedI18nProvider';

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

/**
 * 获取当前语言。
 *
 * @param explicitLocale 显式 locale 覆盖(优先级最高,来自 Layer 2 组件 locale prop)
 */
export function useLang(explicitLocale?: Language): Language {
  // 所有 hooks 无条件调用(Rules of Hooks),优先级仅在返回值中体现
  const ctx = useQuickI18nContext();

  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') return defaultLang;
    return detectLang();
  });

  useEffect(() => {
    const update = () => setLang(detectLang());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  // 优先级: 显式 prop > Provider > 自动检测(html lang → URL)
  if (explicitLocale) return explicitLocale;
  if (ctx?.locale) return ctx.locale;
  return lang;
}

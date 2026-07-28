/**
 * useWorkspaceLang — 获取当前 Workspace UI 语言。
 *
 * 优先级链（与 embed-image useLang 一致）：
 *   1. explicitLocale 参数（组件 locale prop 直接传入，最高优先级）
 *   2. WorkspaceI18nProvider 注入的 locale
 *   3. document.documentElement.lang 检测
 *   4. URL 路径前缀解析（回退）
 *
 * 监听 popstate 事件以支持 SPA 式导航。
 */
import { useSyncExternalStore } from 'react';
import { getLangFromUrl } from './utils.js';
import { defaultLang, languages, type Language } from './config.js';
import { useWorkspaceI18nContext } from './WorkspaceI18nProvider.js';

const SUPPORTED_HTML_LANGS: ReadonlySet<string> = new Set(Object.keys(languages));

/** 从 document.documentElement.lang 读取语言，回退到 URL 解析 */
export function detectLang(): Language {
  if (typeof document === 'undefined') return defaultLang;
  // HTML lang 大小写不敏感,且常带地区子标签(zh-CN / en-US / zh-Hans),取主子标签匹配
  const htmlLang = document.documentElement.lang.toLowerCase().split('-')[0];
  if (htmlLang && SUPPORTED_HTML_LANGS.has(htmlLang)) {
    return htmlLang as Language;
  }
  return getLangFromUrl(window.location.href);
}

function subscribePopstate(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function getServerLang(): Language {
  return defaultLang;
}

/**
 * 获取当前语言。
 *
 * @param explicitLocale 显式 locale 覆盖（优先级最高，来自组件 locale prop）
 */
export function useWorkspaceLang(explicitLocale?: Language): Language {
  // 所有 hooks 无条件调用（Rules of Hooks），优先级仅在返回值中体现
  const ctx = useWorkspaceI18nContext();

  // useSyncExternalStore:SSR/hydration 阶段用 defaultLang,避免服务端
  // (en)与客户端首次渲染(检测语言)不一致导致 hydration mismatch
  const lang = useSyncExternalStore(subscribePopstate, detectLang, getServerLang);

  // 优先级: 显式 prop > Provider > 自动检测（html lang → URL）
  if (explicitLocale) return explicitLocale;
  if (ctx?.locale) return ctx.locale;
  return lang;
}

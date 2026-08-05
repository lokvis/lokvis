/**
 * i18n React 胶水工厂(FO-15)
 *
 * 消除 embed-image / embed-pdf / embed-video / ui-react / playground 此前
 * ~5×170 行重复的 useLang + Provider + utils 样板。
 *
 * 三个工厂:
 * - createI18nContext(): 创建 Context + Provider + useContext hook
 * - createUseLang(): 创建 useLang hook(useSyncExternalStore + popstate)
 * - createTranslateUtils(): 创建 t() + useTranslations() 工具
 *
 * 设计约束:
 * - React 作为 peerDependency,核心 @lokvis/i18n 保持框架无关
 * - 统一使用 useSyncExternalStore(避免 SSR hydration mismatch)
 * - detectLang 采用 ui-react 的 subtag 规范化(.toLowerCase().split('-')[0])
 */

import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type Context,
} from 'react';
import type { ReactNode } from 'react';
import { defaultLang, languages } from './config.js';
import type { Language } from './config.js';
import { getLangFromUrl } from './lang.js';
import { translate } from './translate.js';
import type { TranslateParams, TranslationOverrides } from './translate.js';

// ─── detectLang ──────────────────────────────────────────────

/** HTML lang 属性支持的语言集合(从 languages 配置自动推导) */
const SUPPORTED_HTML_LANGS = new Set(Object.keys(languages));

/**
 * 检测当前语言(优先级:document.documentElement.lang → URL path prefix → defaultLang)
 *
 * 采用 ui-react 的 subtag 规范化:zh-CN → zh, en-US → en。
 * SSR 安全:无 document 时返回 defaultLang。
 */
export function detectLang(
  doc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined
): Language {
  if (!doc || !win) {
    return defaultLang;
  }
  const htmlLang = (doc.documentElement.lang.toLowerCase().split('-')[0] ?? '');
  if (htmlLang && SUPPORTED_HTML_LANGS.has(htmlLang)) {
    return htmlLang as Language;
  }
  const urlLang = getLangFromUrl(win.location.href);
  if (urlLang && SUPPORTED_HTML_LANGS.has(urlLang)) {
    return urlLang;
  }
  return defaultLang;
}

// ─── createI18nContext ───────────────────────────────────────

/** Provider context 值接口 */
export interface I18nContextValue<T> {
  locale: Language;
  translations?: T;
}

/** Provider props:flat locale + optional translations + children */
export interface I18nProviderProps<T> {
  locale: Language;
  translations?: T;
  children: ReactNode;
}

/** createI18nContext 返回值 */
export interface I18nContextResult<T> {
  Context: Context<I18nContextValue<T> | null>;
  Provider: (props: I18nProviderProps<T>) => ReactNode;
  useContextHook: () => I18nContextValue<T>;
}

/**
 * 创建 i18n Context + Provider + useContext hook
 *
 * @example
 * ```ts
 * const { Provider: EmbedI18nProvider, useContextHook: useQuickI18nContext } =
 *   createI18nContext<EmbedTranslations>();
 * ```
 */
export function createI18nContext<T = Record<string, Partial<Record<Language, string>>>>(): I18nContextResult<T> {
  const Context = createContext<I18nContextValue<T> | null>(null);

  function Provider({ locale, translations, children }: I18nProviderProps<T>) {
    const value = useMemo<I18nContextValue<T>>(
      () => ({ locale, translations }),
      [locale, translations]
    );
    return createElement(Context.Provider, { value }, children);
  }

  function useContextHook(): I18nContextValue<T> {
    const ctx = useContext(Context);
    if (!ctx) {
      return { locale: defaultLang };
    }
    return ctx;
  }

  return { Context, Provider, useContextHook };
}

// ─── createUseLang ───────────────────────────────────────────

/** popstate 订阅(供 useSyncExternalStore 使用) */
function subscribePopstate(callback: () => void): () => void {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}

/** SSR 安全的 detectLang(供 useSyncExternalStore 的 getServerSnapshot 使用) */
function getServerLang(): Language {
  return defaultLang;
}

/**
 * 创建 useLang hook
 *
 * 优先级链:
 * 1. explicitLocale 参数(组件 locale prop)
 * 2. contextLocale(Provider context)
 * 3. document.documentElement.lang 检测
 * 4. URL path prefix 解析
 *
 * 使用 useSyncExternalStore 避免 SSR hydration mismatch。
 *
 * @param useContextHook 从 createI18nContext 返回的 useContext hook
 */
export function createUseLang<T>(
  useContextHook: () => I18nContextValue<T> | null
): (explicitLocale?: Language) => Language {
  return function useLang(explicitLocale?: Language): Language {
    const contextValue = useContextHook();
    const detected = useSyncExternalStore(
      subscribePopstate,
      // Bind document/window to current global scope
      () => detectLang(typeof document !== 'undefined' ? document : undefined, typeof window !== 'undefined' ? window : undefined),
      getServerLang
    );

    if (explicitLocale) return explicitLocale;
    if (contextValue?.locale && contextValue.locale !== defaultLang) {
      return contextValue.locale;
    }
    return detected;
  };
}

// ─── createTranslateUtils ────────────────────────────────────

/** 翻译字典类型 */
export type TranslationDictionary = Record<string, Partial<Record<Language, string>>>;

/**
 * 创建 t() + useTranslations() 工具
 *
 * 委托核心 translate() 函数,保证回退链与插值行为一致:
 * overrides[key][lang] → overrides[key][defaultLang]
 * → dict[key][lang] → dict[key][defaultLang] → key 本身
 *
 * @param ui 包的翻译字典
 * @param useContextHook 从 createI18nContext 返回的 useContext hook
 */
export function createTranslateUtils<T extends TranslationDictionary>(
  ui: T,
  useContextHook: () => I18nContextValue<T> | null
) {
  /**
   * 翻译函数:根据 lang + key 返回翻译字符串,支持 overrides 与 {name} 插值。
   */
  function t(
    lang: Language,
    key: string,
    overrides?: TranslationOverrides,
    params?: TranslateParams
  ): string {
    return translate(ui, lang, key, overrides, params);
  }

  /**
   * React hook:返回带 overrides 的翻译函数。
   *
   * 优先级:explicitOverrides 参数 → Provider.translations → 包内字典。
   */
  function useTranslations(
    lang: Language,
    explicitOverrides?: TranslationOverrides
  ): (key: string, params?: TranslateParams) => string {
    const contextValue = useContextHook();
    const overrides = explicitOverrides ?? contextValue?.translations;
    return (key: string, params?: TranslateParams) => t(lang, key, overrides, params);
  }

  return { t, useTranslations };
}

// ─── Re-exports for convenience ──────────────────────────────

export { getLangFromUrl, localizePath, switchLangPath } from './lang.js';
export type { Language } from './config.js';

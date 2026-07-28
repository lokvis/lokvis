/**
 * i18n 工具函数（@lokvis/ui-react 内部）。
 *
 * 与 embed-image 同构，额外支持 {name} 参数插值（store 侧消息
 * 如 'Importing {count} file(s)...' 需要 key + params 而非纯字符串）。
 *
 * 翻译优先级：overrides[key][lang] → overrides[key][en] → ui[key][lang]
 *             → ui[key][en] → key 本身。
 */
import { useCallback } from 'react';
import { defaultLang, languages, type Language } from './config.js';
import { ui } from './ui.js';
import {
  useWorkspaceI18nContext,
  type WorkspaceTranslations,
} from './WorkspaceI18nProvider.js';

export type { Language };
export type { WorkspaceTranslations };

/** 插值参数表：{name} 占位符 → 值 */
export type TranslateParams = Record<string, string | number>;

/** 翻译函数签名（useWorkspaceTranslations 的返回值） */
export type TranslateFn = (key: string, params?: TranslateParams) => string;

const SUPPORTED_LANGS: ReadonlySet<string> = new Set(Object.keys(languages));

function isLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGS.has(lang);
}

/** 从 URL 路径提取语言（/zh/xxx → 'zh'） */
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

/** {name} 占位符插值 */
function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

const pluralRulesCache = new Map<Language, Intl.PluralRules>();

/**
 * 按语言复数规则选择 `${base}One` / `${base}Other` key。
 *
 * 集中复数选择逻辑,避免组件内硬编码 `count === 1`
 * (如法语中 0 为单数:"0 étape" 而非 "0 étapes")。
 */
export function pluralKey(lang: Language, base: string, count: number): string {
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, rules);
  }
  return rules.select(count) === 'one' ? `${base}One` : `${base}Other`;
}

/**
 * 翻译函数：根据 lang + key 返回对应字符串，支持 {name} 参数插值。
 *
 * @param lang 当前语言
 * @param key 翻译 key（如 'inspector.title'）
 * @param overrides 消费方注入的翻译覆盖（可选）
 * @param params 插值参数（可选）
 */
export function t(
  lang: Language,
  key: string,
  overrides?: WorkspaceTranslations,
  params?: TranslateParams
): string {
  const override = overrides?.[key];
  if (override) {
    const resolved = override[lang] ?? override[defaultLang];
    if (resolved) return interpolate(resolved, params);
  }
  const entry = ui[key]?.[lang] ?? ui[key]?.[defaultLang];
  if (entry !== undefined) return interpolate(entry, params);
  return key;
}

/**
 * 创建翻译函数（React 组件用）。
 *
 * @param lang 当前语言（由 useWorkspaceLang 推导）
 * @param explicitOverrides 组件 translations prop 传入的显式覆盖（优先于 Provider.translations）
 */
export function useWorkspaceTranslations(
  lang: Language,
  explicitOverrides?: WorkspaceTranslations
): TranslateFn {
  const ctx = useWorkspaceI18nContext();
  const overrides = explicitOverrides ?? ctx?.translations;
  // 引用稳定:lang / overrides 不变时返回同一函数,组件可安全用作 memo 依赖
  return useCallback(
    (key: string, params?: TranslateParams) => t(lang, key, overrides, params),
    [lang, overrides]
  );
}

/**
 * i18n 消息引用（store 侧 statusMessage / error 使用）。
 *
 * store 无法感知 locale，因此只存 key + params，
 * 由渲染组件（StatusBar / Toolbar / ProgressBar / ErrorBanner）在渲染时翻译。
 */
export interface I18nMessage {
  key: string;
  params?: TranslateParams;
}

/**
 * 渲染 store 侧消息：I18nMessage 走字典翻译，原始字符串
 * （如 engine 抛出的错误文本）原样返回。
 */
export function formatMessage(
  translate: TranslateFn,
  message: string | I18nMessage
): string {
  return typeof message === 'string' ? message : translate(message.key, message.params);
}

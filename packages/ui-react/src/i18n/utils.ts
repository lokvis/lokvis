/**
 * i18n 工具函数（@lokvis/ui-react 内部）。
 *
 * 语言判定 / URL 解析 / 插值 / 复数 / 翻译回退链统一委托 @lokvis/i18n 核心，
 * 本文件仅提供绑定本包字典（ui）的类型化封装:
 *   - t: 绑定 ui 字典的翻译函数
 *   - useWorkspaceTranslations: React hook（读取 Provider 覆盖）
 *   - formatMessage / I18nMessage: store 侧 key+params 消息渲染
 */
import { useCallback } from 'react';
import {
  defaultLang,
  languages,
  translate,
  getLangFromUrl,
  pluralKey,
  type Language,
  type TranslateParams,
} from '@lokvis/i18n';
import { ui } from './ui.js';
import {
  useWorkspaceI18nContext,
  type WorkspaceTranslations,
} from './WorkspaceI18nProvider.js';

export type { Language };
export type { WorkspaceTranslations };
export type { TranslateParams };

// re-export 核心原语,消费方 import { getLangFromUrl, pluralKey } from utils 保持可用
export { defaultLang, languages, getLangFromUrl, pluralKey };

/** 翻译函数签名（useWorkspaceTranslations 的返回值） */
export type TranslateFn = (key: string, params?: TranslateParams) => string;

/**
 * 翻译函数：根据 lang + key 返回本包字典对应字符串，支持 {name} 参数插值。
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
  return translate(ui, lang, key, overrides, params);
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
  translateFn: TranslateFn,
  message: string | I18nMessage
): string {
  return typeof message === 'string' ? message : translateFn(message.key, message.params);
}

/**
 * i18n 工具函数（@lokvis/ui-react 内部，FO-15 工厂化）。
 *
 * 语言判定 / URL 解析 / 插值 / 复数 / 翻译回退链统一委托 @lokvis/i18n 核心，
 * 本文件仅提供绑定本包字典（ui）的类型化封装:
 *   - t: 绑定 ui 字典的翻译函数
 *   - useWorkspaceTranslations: React hook（读取 Provider 覆盖，useCallback 稳定引用）
 *   - formatMessage / I18nMessage: store 侧 key+params 消息渲染
 */
import { useCallback } from 'react';
import {
  defaultLang,
  languages,
  pluralKey,
  getLangFromUrl,
  type Language,
  type TranslateParams,
} from '@lokvis/i18n';
import { createTranslateUtils } from '@lokvis/i18n/react';
import { ui } from './ui.js';
import {
  useWorkspaceI18nContext,
  type WorkspaceTranslations,
} from './WorkspaceI18nProvider.js';

export type { Language };
export type { WorkspaceTranslations };
export type { TranslateParams };

export { defaultLang, languages, getLangFromUrl, pluralKey };

const { t, useTranslations: _useTranslations } = createTranslateUtils(ui, useWorkspaceI18nContext);

export { t };

/** 翻译函数签名（useWorkspaceTranslations 的返回值） */
export type TranslateFn = (key: string, params?: TranslateParams) => string;

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
  const baseFn = _useTranslations(lang, explicitOverrides);
  return useCallback(
    (key: string, params?: TranslateParams) => baseFn(key, params),
    [baseFn]
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

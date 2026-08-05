/**
 * WorkspaceI18nProvider — @lokvis/ui-react 的 i18n 注入入口(FO-15 工厂化)。
 *
 * 优先级（useWorkspaceLang 内部实现）：
 *   1. 组件 locale prop（最高，per-instance 覆盖）
 *   2. WorkspaceI18nProvider 注入的 locale（app 级别）
 *   3. document.documentElement.lang 检测
 *   4. URL 路径前缀解析（回退）
 */
import { useContext } from 'react';
import type { Language } from './config.js';
import {
  createI18nContext,
  type I18nProviderProps,
} from '@lokvis/i18n/react';

/** 翻译覆盖表：key → language → 文案 */
export type WorkspaceTranslations = Record<string, Partial<Record<Language, string>>>;

/** Provider 注入的 i18n 上下文值 */
export interface WorkspaceI18nContextValue {
  locale: Language;
  translations?: WorkspaceTranslations;
}

const { Provider, Context: WorkspaceI18nContext } =
  createI18nContext<WorkspaceTranslations>();

export { WorkspaceI18nContext };

export type WorkspaceI18nProviderProps = I18nProviderProps<WorkspaceTranslations>;

export const WorkspaceI18nProvider = Provider;

export function useWorkspaceI18nContext(): WorkspaceI18nContextValue | null {
  return useContext(WorkspaceI18nContext);
}

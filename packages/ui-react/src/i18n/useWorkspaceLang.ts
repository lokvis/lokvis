/**
 * useWorkspaceLang — 获取当前 Workspace UI 语言(FO-15 工厂化)。
 *
 * 优先级链：
 *   1. explicitLocale 参数（组件 locale prop 直接传入，最高优先级）
 *   2. WorkspaceI18nProvider 注入的 locale
 *   3. document.documentElement.lang 检测
 *   4. URL 路径前缀解析（回退）
 *
 * 使用 useSyncExternalStore 避免 SSR hydration mismatch。
 */
import type { Language } from './config.js';
import { createUseLang, detectLang } from '@lokvis/i18n/react';
import { useWorkspaceI18nContext } from './WorkspaceI18nProvider.js';

export { detectLang };

export const useWorkspaceLang = createUseLang(useWorkspaceI18nContext) as (explicitLocale?: Language) => Language;

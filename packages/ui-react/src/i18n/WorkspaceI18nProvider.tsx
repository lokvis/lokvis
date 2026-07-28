/**
 * WorkspaceI18nProvider — @lokvis/ui-react 的 i18n 注入入口。
 *
 * 设计复用 embed-image 的 EmbedI18nProvider 模式：
 *   优先级（useWorkspaceLang 内部实现）：
 *     1. 组件 locale prop（最高，per-instance 覆盖）
 *     2. WorkspaceI18nProvider 注入的 locale（app 级别）
 *     3. document.documentElement.lang 检测
 *     4. URL 路径前缀解析（回退）
 *
 * 翻译覆盖：
 *   - 包内自带 6 语言字典（src/i18n/ui.ts）
 *   - 消费方可通过 translations prop 部分覆盖：`{ 'inspector.configure': { zh: '自定义' } }`
 *   - 覆盖优先于包内字典；覆盖缺失的 language 回退到包内默认值
 *
 * 接入示例：
 * ```tsx
 * import { WorkspaceI18nProvider, Workspace } from '@lokvis/ui-react';
 *
 * <WorkspaceI18nProvider locale="zh">
 *   <Workspace />
 * </WorkspaceI18nProvider>
 *
 * // 或 per-instance 覆盖
 * <Workspace locale="zh" />
 * ```
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Language } from './config.js';

/** 翻译覆盖表：key → language → 文案 */
export type WorkspaceTranslations = Record<string, Partial<Record<Language, string>>>;

/** Provider 注入的 i18n 上下文值 */
export interface WorkspaceI18nContextValue {
  /** 当前语言（必传） */
  locale: Language;
  /** 翻译覆盖（可选；部分 key 缺失时回退到包内默认字典） */
  translations?: WorkspaceTranslations;
}

const WorkspaceI18nContext = createContext<WorkspaceI18nContextValue | null>(null);

/**
 * Context 对象（导出供 class 组件 static contextType 使用，如 ErrorBoundary）。
 */
export { WorkspaceI18nContext };

export interface WorkspaceI18nProviderProps extends WorkspaceI18nContextValue {
  children: ReactNode;
}

/** 注入 i18n locale 与可选翻译覆盖。 */
export function WorkspaceI18nProvider({
  locale,
  translations,
  children,
}: WorkspaceI18nProviderProps) {
  const value = useMemo<WorkspaceI18nContextValue>(
    () => ({ locale, translations }),
    [locale, translations]
  );
  return (
    <WorkspaceI18nContext.Provider value={value}>
      {children}
    </WorkspaceI18nContext.Provider>
  );
}

/** 读取 i18n 上下文（无 Provider 时返回 null）。 */
export function useWorkspaceI18nContext(): WorkspaceI18nContextValue | null {
  return useContext(WorkspaceI18nContext);
}

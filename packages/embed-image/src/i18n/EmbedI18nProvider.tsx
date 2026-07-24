/**
 * EmbedI18nProvider — @lokvis/embed-image 的 i18n 注入入口(Task 2 解耦)。
 *
 * 设计动机:
 *   Layer 2 默认 UI 原本通过 useLang() 读取 document.documentElement.lang,
 *   这是 playground/Astro 特定的 locale 路由方案,三方接入时:
 *     - 可能用 react-i18next / FormatJS / Lingui 等自有 i18n 系统
 *     - 可能用 cookie / query string / 用户偏好而非 URL 路径前缀
 *     - 可能想在 SSR / 测试环境固定 locale
 *
 *   Provider 模式让消费方显式注入 locale + 可选翻译覆盖,完全脱离
 *   playground 的 URL/<html lang> 假设。
 *
 * 优先级(useLang 内部实现):
 *   1. 组件 locale prop(最高,per-instance 覆盖)
 *   2. EmbedI18nProvider 注入的 locale(app 级别)
 *   3. document.documentElement.lang 检测(浏览器/Astro 默认)
 *   4. URL 路径前缀解析(回退)
 *
 * 翻译覆盖:
 *   - 包内自带 65 个 key 的 6 语言字典(src/i18n/ui.ts)
 *   - 消费方可通过 translations prop 部分覆盖:`{ 'quickCompress.title': { zh: '自定义' } }`
 *   - 覆盖优先于包内字典;覆盖缺失的 language 回退到包内默认值
 *
 * 接入示例:
 * ```tsx
 * import { EmbedI18nProvider, EmbedImageCompress } from '@lokvis/embed-image';
 *
 * <EmbedI18nProvider locale="zh">
 *   <EmbedImageCompress />
 * </EmbedI18nProvider>
 *
 * // 或 per-instance 覆盖(适合 client:only Astro)
 * <EmbedImageCompress locale="zh" />
 *
 * // 或注入翻译覆盖
 * <EmbedI18nProvider
 *   locale="zh"
 *   translations={{ 'quickCompress.title': { zh: '我的压缩' } }}
 * >
 *   <EmbedImageCompress />
 * </EmbedI18nProvider>
 * ```
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Language } from './config';

/** 翻译覆盖表:key → language → 文案 */
export type EmbedTranslations = Record<string, Partial<Record<Language, string>>>;

/** Provider 注入的 i18n 上下文值 */
export interface QuickI18nContextValue {
  /** 当前语言(必传) */
  locale: Language;
  /** 翻译覆盖(可选;部分 key 缺失时回退到包内默认字典) */
  translations?: EmbedTranslations;
}

const QuickI18nContext = createContext<QuickI18nContextValue | null>(null);

/**
 * Context 对象(导出供 class 组件 static contextType 使用,如 ErrorBoundary)。
 *
 * 消费方一般使用 useQuickI18nContext() hook;此导出仅为类组件兼容性提供。
 */
export { QuickI18nContext };

export interface EmbedI18nProviderProps extends QuickI18nContextValue {
  children: ReactNode;
}

/**
 * 注入 i18n locale 与可选翻译覆盖。
 *
 * 配合 useLang / useTranslations 自动生效;Layer 2 默认 UI 内部已接入。
 */
export function EmbedI18nProvider({
  locale,
  translations,
  children,
}: EmbedI18nProviderProps) {
  const value = useMemo<QuickI18nContextValue>(
    () => ({ locale, translations }),
    [locale, translations]
  );
  return (
    <QuickI18nContext.Provider value={value}>
      {children}
    </QuickI18nContext.Provider>
  );
}

/**
 * 读取 i18n 上下文(无 Provider 时返回 null)。
 *
 * 供内部 useLang / useTranslations 使用;消费方一般不需要直接调用。
 */
export function useQuickI18nContext(): QuickI18nContextValue | null {
  return useContext(QuickI18nContext);
}

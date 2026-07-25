/**
 * EmbedPdfI18nProvider — @lokvis/embed-pdf 的 i18n 注入入口。
 *
 * Provider 模式让消费方显式注入 locale + 可选翻译覆盖,完全脱离
 * playground 的 URL/<html lang> 假设。
 *
 * 优先级(useLang 内部实现):
 *   1. 组件 locale prop(最高,per-instance 覆盖)
 *   2. EmbedPdfI18nProvider 注入的 locale(app 级别)
 *   3. document.documentElement.lang 检测(浏览器默认)
 *   4. URL 路径前缀解析(回退)
 *
 * 接入示例:
 * ```tsx
 * import { EmbedPdfI18nProvider, EmbedPdfCompress } from '@lokvis/embed-pdf';
 *
 * <EmbedPdfI18nProvider locale="zh">
 *   <EmbedPdfCompress />
 * </EmbedPdfI18nProvider>
 * ```
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Language } from './config';

/** 翻译覆盖表:key → language → 文案 */
export type EmbedPdfTranslations = Record<string, Partial<Record<Language, string>>>;

/** Provider 注入的 i18n 上下文值 */
export interface PdfI18nContextValue {
  /** 当前语言(必传) */
  locale: Language;
  /** 翻译覆盖(可选;部分 key 缺失时回退到包内默认字典) */
  translations?: EmbedPdfTranslations;
}

export const PdfI18nContext = createContext<PdfI18nContextValue | null>(null);

export interface EmbedPdfI18nProviderProps extends PdfI18nContextValue {
  children: ReactNode;
}

/**
 * 注入 i18n locale 与可选翻译覆盖。
 *
 * 配合 useLang / useTranslations 自动生效;Layer 2 默认 UI 内部已接入。
 */
export function EmbedPdfI18nProvider({
  locale,
  translations,
  children,
}: EmbedPdfI18nProviderProps) {
  const value = useMemo<PdfI18nContextValue>(
    () => ({ locale, translations }),
    [locale, translations]
  );
  return (
    <PdfI18nContext.Provider value={value}>
      {children}
    </PdfI18nContext.Provider>
  );
}

/**
 * 读取 i18n 上下文(无 Provider 时返回 null)。
 *
 * 供内部 useLang / useTranslations 使用;消费方一般不需要直接调用。
 */
export function usePdfI18nContext(): PdfI18nContextValue | null {
  return useContext(PdfI18nContext);
}

/**
 * EmbedPdfI18nProvider — @lokvis/embed-pdf 的 i18n 注入入口(FO-15 工厂化)。
 *
 * 优先级(useLang 内部实现):
 *   1. 组件 locale prop(最高,per-instance 覆盖)
 *   2. EmbedPdfI18nProvider 注入的 locale(app 级别)
 *   3. document.documentElement.lang 检测(浏览器默认)
 *   4. URL 路径前缀解析(回退)
 */
import { useContext } from 'react';
import type { Language } from './config';
import {
  createI18nContext,
  type I18nProviderProps,
} from '@lokvis/i18n/react';

/** 翻译覆盖表:key → language → 文案 */
export type EmbedPdfTranslations = Record<string, Partial<Record<Language, string>>>;

/** Provider 注入的 i18n 上下文值 */
export interface PdfI18nContextValue {
  locale: Language;
  translations?: EmbedPdfTranslations;
}

const { Provider, Context: PdfI18nContext } =
  createI18nContext<EmbedPdfTranslations>();

export { PdfI18nContext };

export type EmbedPdfI18nProviderProps = I18nProviderProps<EmbedPdfTranslations>;

export const EmbedPdfI18nProvider = Provider;

export function usePdfI18nContext(): PdfI18nContextValue | null {
  return useContext(PdfI18nContext);
}

/**
 * EmbedVideoI18nProvider — @lokvis/embed-video 的 i18n 注入入口(FO-15 工厂化)。
 *
 * 优先级(useLang 内部实现):
 *   1. 组件 locale prop(最高,per-instance 覆盖)
 *   2. EmbedVideoI18nProvider 注入的 locale(app 级别)
 *   3. document.documentElement.lang 检测(浏览器/Astro 默认)
 *   4. URL 路径前缀解析(回退)
 */
import { useContext } from 'react';
import type { Language } from './config';
import {
  createI18nContext,
  type I18nProviderProps,
} from '@lokvis/i18n/react';

/** 翻译覆盖表:key → language → 文案 */
export type EmbedVideoTranslations = Record<string, Partial<Record<Language, string>>>;

/** Provider 注入的 i18n 上下文值 */
export interface VideoI18nContextValue {
  locale: Language;
  translations?: EmbedVideoTranslations;
}

const { Provider, Context: VideoI18nContext } =
  createI18nContext<EmbedVideoTranslations>();

export { VideoI18nContext };

export type EmbedVideoI18nProviderProps = I18nProviderProps<EmbedVideoTranslations>;

export const EmbedVideoI18nProvider = Provider;

export function useVideoI18nContext(): VideoI18nContextValue | null {
  return useContext(VideoI18nContext);
}

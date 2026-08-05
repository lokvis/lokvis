/**
 * useLang - React hook,获取当前页面语言(@lokvis/embed-image 内部,FO-15 工厂化)。
 *
 * 优先级链:
 *   1. explicitLocale 参数(组件 locale prop 直接传入,最高优先级)
 *   2. EmbedI18nProvider 注入的 locale(Provider 模式)
 *   3. document.documentElement.lang 检测(浏览器环境,Astro SSR 默认行为)
 *   4. URL 路径前缀解析(回退方案)
 */
import type { Language } from './config';
import { createUseLang } from '@lokvis/i18n/react';
import { useQuickI18nContext } from './EmbedI18nProvider';

export const useLang = createUseLang(useQuickI18nContext) as (explicitLocale?: Language) => Language;

/**
 * i18n 工具函数(@lokvis/embed-pdf 内部,FO-15 工厂化)。
 *
 * 语言判定 / URL·路径处理 / 翻译回退链统一委托 @lokvis/i18n 核心,
 * 本文件仅提供绑定本包字典(ui)的类型化封装。
 */
import type { Language } from './config';
import { createTranslateUtils } from '@lokvis/i18n/react';
import { ui } from './ui';
import { usePdfI18nContext } from './EmbedPdfI18nProvider';

export type { Language };
export type { EmbedPdfTranslations } from './EmbedPdfI18nProvider';
export { getLangFromUrl, localizePath, switchLangPath } from '@lokvis/i18n/react';

const { t, useTranslations } = createTranslateUtils(ui, usePdfI18nContext);

export { t, useTranslations };

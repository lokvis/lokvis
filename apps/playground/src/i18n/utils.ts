/**
 * i18n 工具函数(FO-15 工厂化)。
 *
 * playground 无 Provider，翻译仅绑定站点字典。
 */
import type { Language } from '@lokvis/i18n';
import { createTranslateUtils } from '@lokvis/i18n/react';
import { ui } from './ui';

export type { Language };
export { getLangFromUrl, localizePath, switchLangPath } from '@lokvis/i18n/react';

const { t, useTranslations } = createTranslateUtils(ui, () => null);

export { t, useTranslations };

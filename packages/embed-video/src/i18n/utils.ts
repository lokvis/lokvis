/**
 * i18n 工具函数(@lokvis/embed-video 内部)。
 *
 * 语言判定 / URL·路径处理 / 翻译回退链统一委托 @lokvis/i18n 核心,
 * 本文件仅提供绑定本包字典(ui)的类型化封装:
 *   - t: 绑定 ui 字典的翻译函数(支持 overrides)
 *   - useTranslations: React hook(读取 EmbedVideoI18nProvider 覆盖)
 */
import {
  getLangFromUrl,
  localizePath,
  switchLangPath,
  translate,
  type Language,
} from '@lokvis/i18n';
import { ui } from './ui';
import { useVideoI18nContext, type EmbedVideoTranslations } from './EmbedVideoI18nProvider';

// re-export 类型,方便外部 import { type Language } from '@lokvis/embed-video'
export type { Language };
// re-export EmbedVideoTranslations 供消费方构造 overrides 类型
export type { EmbedVideoTranslations };

// re-export 核心原语,保持 import { getLangFromUrl, localizePath, switchLangPath } 可用
export { getLangFromUrl, localizePath, switchLangPath };

/**
 * 翻译函数:根据 lang + key 返回本包字典对应字符串。
 *
 * @param lang 当前语言
 * @param key 翻译 key(如 'videoCompress.title')
 * @param overrides 消费方注入的翻译覆盖(可选)
 */
export function t(
  lang: Language,
  key: string,
  overrides?: EmbedVideoTranslations
): string {
  return translate(ui, lang, key, overrides);
}

/**
 * 创建翻译函数(React 组件用)。
 *
 * 优先级:explicitOverrides 参数 → EmbedVideoI18nProvider.translations → 包内字典。
 *
 * @param lang 当前语言(由 useLang 推导)
 * @param explicitOverrides 组件 translations prop 传入的显式覆盖(优先级最高)
 */
export function useTranslations(lang: Language, explicitOverrides?: EmbedVideoTranslations) {
  const ctx = useVideoI18nContext();
  // 显式 prop 优先于 Provider.translations
  const overrides = explicitOverrides ?? ctx?.translations;
  return (key: string) => t(lang, key, overrides);
}

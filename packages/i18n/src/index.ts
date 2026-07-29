/**
 * @lokvis/i18n — 共享 i18n 核心原语。
 *
 * 导出:语言配置 / 语言判定 / URL·路径处理 / 字典翻译原语。
 * 消费包在此之上维护各自的 `ui` 字典、Provider 与类型化 hook 封装。
 */
export {
  languages,
  defaultLang,
  langList,
  type Language,
} from './config.js';

export {
  isLanguage,
  getLangFromUrl,
  localizePath,
  switchLangPath,
  LANG_PREFIX_RE,
} from './lang.js';

export {
  interpolate,
  translate,
  pluralKey,
  type TranslationEntry,
  type TranslationDict,
  type ReadableDict,
  type TranslationOverrides,
  type TranslateParams,
} from './translate.js';

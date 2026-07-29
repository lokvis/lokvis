/**
 * i18n 语言配置(playground)。
 *
 * 语言集合与默认语言统一来自 @lokvis/i18n 核心,此处仅 re-export。
 * 路由策略:路径前缀 /en/ /zh/ /ja/ /es/ /de/ /fr/
 * (astro.config.mjs i18n.prefixDefaultLocale: true)。
 */
export { languages, defaultLang, langList, type Language } from '@lokvis/i18n';

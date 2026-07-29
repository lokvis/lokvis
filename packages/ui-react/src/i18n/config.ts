/**
 * i18n 语言配置(@lokvis/ui-react)。
 *
 * 语言集合与默认语言统一来自 @lokvis/i18n 核心,此处仅 re-export,
 * 保证与其它包(embed-* / playground)6 语言一致。字典与 Provider
 * 仍由本包独立维护(key 命名空间隔离)。
 */
export { languages, defaultLang, langList, type Language } from '@lokvis/i18n';

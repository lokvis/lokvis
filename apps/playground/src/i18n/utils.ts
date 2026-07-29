/**
 * i18n 工具函数
 *
 * 语言判定 / URL·路径处理 / 翻译回退链统一委托 @lokvis/i18n 核心，
 * 本文件仅提供绑定站点字典（ui，无 overrides）的封装：
 *   - t: 绑定 ui 字典的翻译函数
 *   - useTranslations: React 组件用翻译函数
 *
 * 6 语言支持：en / zh / ja / es / de / fr
 * 新语言缺失 key 时通过核心 translate 的 fallback 自动回退到 en。
 */
import {
  getLangFromUrl,
  localizePath,
  switchLangPath,
  translate,
  type Language,
} from '@lokvis/i18n';
import { ui } from './ui';

// re-export 类型，方便外部 import { type Language } from '@/i18n/utils'
export type { Language };

// re-export 核心原语，保持 import { getLangFromUrl, localizePath, switchLangPath } 可用
export { getLangFromUrl, localizePath, switchLangPath };

/** 翻译函数：根据 lang 返回站点字典对应字符串（fallback: lang → en → key 本身） */
export function t(lang: Language, key: string): string {
  return translate(ui, lang, key);
}

/** 创建翻译函数（React 组件用） */
export function useTranslations(lang: Language) {
  return (key: string) => t(lang, key);
}

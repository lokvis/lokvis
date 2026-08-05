/**
 * useLang - React hook，获取当前页面语言(FO-15 工厂化)。
 *
 * playground 无 Provider，仅从 `<html lang>` + URL 检测。
 * 使用 useSyncExternalStore 避免 SSR hydration mismatch。
 */
import { createUseLang } from '@lokvis/i18n/react';

const useLang = createUseLang(() => null);

export { useLang };

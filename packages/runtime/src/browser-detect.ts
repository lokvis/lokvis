/**
 * 浏览器能力检测(W22.3)
 *
 * @deprecated 实现已迁移至 @lokvis/browser-adapter(ADR-015)。
 * 本模块仅为 API 兼容保留 re-export,下一个 major 移除;
 * 新代码请直接 import '@lokvis/browser-adapter'。
 */

export {
  detectBrowserCapabilities,
  detectBrowserInfo,
  isSafari,
  isFirefox,
  _resetBrowserDetectCache,
} from '@lokvis/browser-adapter';
export type {
  BrowserCapabilities,
  BrowserInfo,
} from '@lokvis/browser-adapter';

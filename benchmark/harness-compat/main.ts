/**
 * FormatSupportProbe compat harness —— 在真实 chromium 内跑 encode 探测。
 *
 * 由 compat-check.mjs 经 Playwright page.evaluate 驱动:
 *   window.__compat.probe(formats) → Record<format, boolean>
 *
 * 用 @lokvis/browser-adapter 的 detectEncodeSupport(编码/encode 真实探测),
 * 与 lokvis-knowledge @lokvis/data-compatibility 的 chrome encode 列逐格式断言,
 * 构成同语义双向守卫(ADR-015 + 架构 v2「Knowledge 存 Facts」)。
 */
import { detectEncodeSupport } from '@lokvis/browser-adapter';

const compat = {
  probe(formats: readonly string[]): Promise<Record<string, boolean>> {
    return detectEncodeSupport(formats);
  },
};

declare global {
  interface Window {
    __compat: typeof compat;
  }
}

window.__compat = compat;

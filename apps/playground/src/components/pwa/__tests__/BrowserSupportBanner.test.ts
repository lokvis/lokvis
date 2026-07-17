/**
 * BrowserSupportBanner computeBanners 纯函数单测(W22.4)
 *
 * 验证三类提示的触发逻辑:
 * - Firefox 浏览器:仅显示总体提示,不叠加 OPFS / OffscreenCanvas 子项
 * - 非 Firefox + OPFS 缺失:显示 OPFS 降级提示
 * - 非 Firefox + OffscreenCanvas 缺失:显示 HTMLCanvas 降级提示
 * - Chrome/Edge/Safari + 能力齐备:返回空数组
 */
import { describe, it, expect } from 'vitest';
import { computeBanners } from '../browser-support-utils';
import type { BrowserCapabilities } from '@lokvis/runtime';

/** 构造全 true 的能力对象(模拟现代 Chrome/Edge/Safari) */
function fullCaps(): BrowserCapabilities {
  return {
    opfs: true,
    indexedDB: true,
    storageEstimate: true,
    webCodecsImageDecoder: true,
    webCodecsVideoDecoder: true,
    webCodecsVideoEncoder: true,
    webCodecsAudioDecoder: true,
    offscreenCanvas: true,
    createImageBitmap: true,
    sharedArrayBuffer: true,
    crossOriginIsolated: true,
    webAssembly: true,
    webWorker: true,
    serviceWorker: true,
  };
}

describe('computeBanners', () => {
  it('Chrome/Edge/Safari + 能力齐备应返回空数组', () => {
    const items = computeBanners(false, fullCaps());
    expect(items).toEqual([]);
  });

  it('Firefox + 能力齐备:仅显示 firefox 总体提示,不叠加子项', () => {
    const items = computeBanners(true, fullCaps());
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('firefox');
    expect(items[0].titleKey).toBe('browserSupport.firefoxTitle');
  });

  it('Firefox + OPFS 缺失:仍只显示 firefox 提示(避免叠加污染)', () => {
    const caps = { ...fullCaps(), opfs: false };
    const items = computeBanners(true, caps);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('firefox');
  });

  it('非 Firefox + OPFS 缺失:显示 opfs-missing 提示', () => {
    const caps = { ...fullCaps(), opfs: false };
    const items = computeBanners(false, caps);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('opfs-missing');
    expect(items[0].titleKey).toBe('browserSupport.opfsMissingTitle');
  });

  it('非 Firefox + OffscreenCanvas 缺失:显示 offscreen-canvas-missing 提示', () => {
    const caps = { ...fullCaps(), offscreenCanvas: false };
    const items = computeBanners(false, caps);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('offscreen-canvas-missing');
    expect(items[0].titleKey).toBe('browserSupport.offscreenCanvasMissingTitle');
  });

  it('非 Firefox + OPFS 与 OffscreenCanvas 同时缺失:显示两条提示', () => {
    const caps = { ...fullCaps(), opfs: false, offscreenCanvas: false };
    const items = computeBanners(false, caps);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['opfs-missing', 'offscreen-canvas-missing'])
    );
  });

  it('SSR 环境(全 false + 非 Firefox):应显示 opfs + offscreen-canvas 两条', () => {
    // 模拟 SSR:所有能力都为 false,isFirefox 也为 false(detectBrowserInfo 在 Node
    // 下返回 unknown)。但实际组件 useEffect 会在 typeof navigator === 'undefined'
    // 时早退,不会调用 computeBanners。此处仅验证纯函数逻辑。
    const ssrCaps: BrowserCapabilities = {
      opfs: false,
      indexedDB: false,
      storageEstimate: false,
      webCodecsImageDecoder: false,
      webCodecsVideoDecoder: false,
      webCodecsVideoEncoder: false,
      webCodecsAudioDecoder: false,
      offscreenCanvas: false,
      createImageBitmap: false,
      sharedArrayBuffer: false,
      crossOriginIsolated: false,
      webAssembly: false,
      webWorker: false,
      serviceWorker: false,
    };
    const items = computeBanners(false, ssrCaps);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['opfs-missing', 'offscreen-canvas-missing'])
    );
  });
});

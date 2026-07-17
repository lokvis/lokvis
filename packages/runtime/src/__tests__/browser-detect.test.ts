/**
 * 浏览器能力检测单元测试(W22.3)
 *
 * 在 Node 环境下验证:
 * - 所有浏览器 API 检测返回 false / unknown(SSR 安全)
 * - UA 嗅探正则正确识别 Safari/ Firefox/ Chrome/ Edge
 * - 缓存机制(同一会话内重复调用返回同一对象)
 * - force 选项可强制重新探测
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectBrowserCapabilities,
  detectBrowserInfo,
  isSafari,
  isFirefox,
  _resetBrowserDetectCache,
} from '../browser-detect.js';

beforeEach(() => {
  _resetBrowserDetectCache();
});

afterEach(() => {
  _resetBrowserDetectCache();
  vi.unstubAllGlobals();
});

// ─── detectBrowserCapabilities ────────────────────────────────

describe('detectBrowserCapabilities', () => {
  it('Node 环境下 OPFS/IndexedDB 应返回 false(SSR 安全)', () => {
    const caps = detectBrowserCapabilities();
    expect(caps.opfs).toBe(false);
    expect(caps.indexedDB).toBe(false);
    expect(caps.storageEstimate).toBe(false);
  });

  it('Node 环境下 WebCodecs 应全部返回 false', () => {
    const caps = detectBrowserCapabilities();
    expect(caps.webCodecsImageDecoder).toBe(false);
    expect(caps.webCodecsVideoDecoder).toBe(false);
    expect(caps.webCodecsVideoEncoder).toBe(false);
    expect(caps.webCodecsAudioDecoder).toBe(false);
  });

  it('Node 环境下 OffscreenCanvas/createImageBitmap 应返回 false', () => {
    const caps = detectBrowserCapabilities();
    expect(caps.offscreenCanvas).toBe(false);
    expect(caps.createImageBitmap).toBe(false);
  });

  it('Node 环境下 crossOriginIsolated 应返回 false', () => {
    const caps = detectBrowserCapabilities();
    expect(caps.crossOriginIsolated).toBe(false);
  });

  it('Node 环境下 WebAssembly 应返回 true(Node 内置)', () => {
    const caps = detectBrowserCapabilities();
    expect(caps.webAssembly).toBe(true);
  });

  it('注入 globalThis.VideoDecoder 后应检测到 webCodecsVideoDecoder', () => {
    vi.stubGlobal('VideoDecoder', class FakeVideoDecoder {});
    const caps = detectBrowserCapabilities({ force: true });
    expect(caps.webCodecsVideoDecoder).toBe(true);
  });

  it('注入 globalThis.OffscreenCanvas 后应检测到 offscreenCanvas', () => {
    vi.stubGlobal('OffscreenCanvas', class FakeOffscreenCanvas {});
    const caps = detectBrowserCapabilities({ force: true });
    expect(caps.offscreenCanvas).toBe(true);
  });

  it('注入 navigator.storage.getDirectory 后应检测到 opfs', () => {
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn(),
        estimate: vi.fn(),
      },
      serviceWorker: {},
    });
    const caps = detectBrowserCapabilities({ force: true });
    expect(caps.opfs).toBe(true);
    expect(caps.storageEstimate).toBe(true);
    expect(caps.serviceWorker).toBe(true);
  });

  it('注入 globalThis.crossOriginIsolated=true 后应检测到', () => {
    vi.stubGlobal('crossOriginIsolated', true);
    const caps = detectBrowserCapabilities({ force: true });
    expect(caps.crossOriginIsolated).toBe(true);
  });

  it('缓存:同一会话内重复调用返回同一对象引用', () => {
    const a = detectBrowserCapabilities();
    const b = detectBrowserCapabilities();
    expect(a).toBe(b);
  });

  it('force: true 应强制重新探测,返回新对象', () => {
    const a = detectBrowserCapabilities();
    const b = detectBrowserCapabilities({ force: true });
    expect(a).not.toBe(b);
  });
});

// ─── detectBrowserInfo(UA 嗅探) ──────────────────────────────

describe('detectBrowserInfo', () => {
  it('Node 环境(无 navigator)应返回 unknown', () => {
    const info = detectBrowserInfo();
    expect(info.name).toBe('unknown');
    expect(info.version).toBe(0);
    expect(info.isSafari).toBe(false);
    expect(info.isFirefox).toBe(false);
    expect(info.isChrome).toBe(false);
    expect(info.isEdge).toBe(false);
    expect(info.isMobile).toBe(false);
  });

  it('Safari macOS UA 应识别为 safari', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    const info = detectBrowserInfo({ force: true });
    expect(info.name).toBe('safari');
    expect(info.version).toBe(17);
    expect(info.isSafari).toBe(true);
    expect(info.isMobile).toBe(false);
  });

  it('Safari iOS UA 应识别为 safari + isMobile', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const info = detectBrowserInfo({ force: true });
    expect(info.name).toBe('safari');
    expect(info.version).toBe(17);
    expect(info.isSafari).toBe(true);
    expect(info.isMobile).toBe(true);
  });

  it('Firefox UA 应识别为 firefox', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:120.0) Gecko/20100101 Firefox/120.0',
    });
    const info = detectBrowserInfo({ force: true });
    expect(info.name).toBe('firefox');
    expect(info.version).toBe(120);
    expect(info.isFirefox).toBe(true);
  });

  it('Chrome UA 应识别为 chrome(不含 Edg/)', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const info = detectBrowserInfo({ force: true });
    expect(info.name).toBe('chrome');
    expect(info.version).toBe(120);
    expect(info.isChrome).toBe(true);
    expect(info.isEdge).toBe(false);
  });

  it('Edge UA(含 Edg/)应识别为 edge 而非 chrome', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    });
    const info = detectBrowserInfo({ force: true });
    expect(info.name).toBe('edge');
    expect(info.version).toBe(120);
    expect(info.isEdge).toBe(true);
    expect(info.isChrome).toBe(false);
  });

  it('Chrome UA 含 "Version/X Safari/" 但含 Chrome/ 不应误判为 safari', () => {
    // 某些基于 Chromium 的浏览器 UA 可能含 Version/ 字段
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const info = detectBrowserInfo({ force: true });
    // Chrome UA 含 Chrome/ → 排除 Safari 判定
    expect(info.name).toBe('chrome');
    expect(info.isSafari).toBe(false);
  });

  it('缓存:同一会话内重复调用返回同一对象引用', () => {
    const a = detectBrowserInfo();
    const b = detectBrowserInfo();
    expect(a).toBe(b);
  });

  it('force: true 应强制重新识别,返回新对象', () => {
    const a = detectBrowserInfo();
    const b = detectBrowserInfo({ force: true });
    expect(a).not.toBe(b);
  });
});

// ─── isSafari / isFirefox 便捷函数 ───────────────────────────

describe('isSafari / isFirefox 便捷函数', () => {
  it('Node 环境(无 navigator)isSafari 应返回 false', () => {
    expect(isSafari()).toBe(false);
  });

  it('Node 环境(无 navigator)isFirefox 应返回 false', () => {
    expect(isFirefox()).toBe(false);
  });

  it('Safari UA 下 isSafari 应返回 true', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    _resetBrowserDetectCache();
    expect(isSafari()).toBe(true);
    expect(isFirefox()).toBe(false);
  });

  it('Firefox UA 下 isFirefox 应返回 true', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:120.0) Gecko/20100101 Firefox/120.0',
    });
    _resetBrowserDetectCache();
    expect(isFirefox()).toBe(true);
    expect(isSafari()).toBe(false);
  });
});

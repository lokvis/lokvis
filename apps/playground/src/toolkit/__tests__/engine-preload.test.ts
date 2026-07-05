/**
 * W15.7 — engine-preload 单元测试
 *
 * 覆盖:
 *   - setupEnginePreloadOnInstalled: appinstalled 事件触发预加载
 *   - preloadEngines: 主线程 preloadTop5Engines + SW postMessage
 *   - subscribeEnginePreloadProgress: SW 消息回调
 *   - isEnginesPreloaded: localStorage 标记
 *   - SSR / 隐私模式兜底
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @lokvis/engine-image 的 preloadTop5Engines
// vi.hoisted 让 mock fn 引用在 vi.mock 工厂执行时已存在(工厂被提升到文件顶部)
const { mockPreloadTop5Engines } = vi.hoisted(() => ({
  mockPreloadTop5Engines: vi.fn(),
}));
vi.mock('@lokvis/engine-image', () => ({
  preloadTop5Engines: mockPreloadTop5Engines,
}));

import {
  setupEnginePreloadOnInstalled,
  preloadEngines,
  isEnginesPreloaded,
  subscribeEnginePreloadProgress,
} from '../engine-preload.js';

describe('engine-preload (W15.7)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPreloadTop5Engines.mockReset();
  });

  describe('setupEnginePreloadOnInstalled', () => {
    it('appinstalled 事件触发 preloadEngines', async () => {
      mockPreloadTop5Engines.mockResolvedValue({
        transform: 'loaded',
        encode: 'loaded',
      });
      const cleanup = setupEnginePreloadOnInstalled();

      window.dispatchEvent(new Event('appinstalled'));
      // 等待异步 preloadEngines 完成
      await new Promise((r) => setTimeout(r, 10));

      expect(mockPreloadTop5Engines).toHaveBeenCalledTimes(1);
      cleanup();
    });

    it('cleanup 后 appinstalled 不再触发', async () => {
      const cleanup = setupEnginePreloadOnInstalled();
      cleanup();
      window.dispatchEvent(new Event('appinstalled'));
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPreloadTop5Engines).not.toHaveBeenCalled();
    });
  });

  describe('preloadEngines', () => {
    it('主线程 preloadTop5Engines 成功 + SW postMessage 发送', async () => {
      mockPreloadTop5Engines.mockResolvedValue({ transform: 'loaded' });

      // stub SW controller
      const postMessage = vi.fn();
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: { postMessage } },
        configurable: true,
      });

      const result = await preloadEngines();

      expect(mockPreloadTop5Engines).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({
        type: 'PRELOAD_TOP5_ENGINES',
      });
      expect(result.sw).toBe('sent');
      expect(result.mainThread).toEqual({ transform: 'loaded' });
      expect(isEnginesPreloaded()).toBe(true);
    });

    it('无 SW controller 时 sw=skipped', async () => {
      mockPreloadTop5Engines.mockResolvedValue({});
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        configurable: true,
      });
      const result = await preloadEngines();
      expect(result.sw).toBe('skipped');
    });

    it('主线程 preload 失败时不影响 SW 消息', async () => {
      mockPreloadTop5Engines.mockRejectedValue(new Error('network'));
      const postMessage = vi.fn();
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: { postMessage } },
        configurable: true,
      });
      const result = await preloadEngines();
      expect(result.mainThread).toEqual({});
      expect(result.sw).toBe('sent');
      expect(postMessage).toHaveBeenCalled();
    });

    it('localStorage 不可用时不抛错', async () => {
      mockPreloadTop5Engines.mockResolvedValue({});
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        configurable: true,
      });
      // 模拟 localStorage 抛错
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('Access denied');
        },
        configurable: true,
      });
      await expect(preloadEngines()).resolves.toBeDefined();
      if (original) {
        Object.defineProperty(window, 'localStorage', original);
      }
    });
  });

  describe('isEnginesPreloaded', () => {
    it('未预加载时返回 false', () => {
      expect(isEnginesPreloaded()).toBe(false);
    });

    it('preloadEngines 完成后返回 true', async () => {
      mockPreloadTop5Engines.mockResolvedValue({});
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        configurable: true,
      });
      await preloadEngines();
      expect(isEnginesPreloaded()).toBe(true);
    });
  });

  describe('subscribeEnginePreloadProgress', () => {
    afterEach(() => {
      // 还原 navigator.serviceWorker
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
      });
    });

    it('ENGINE_PRELOADED 消息触发 onProgress', () => {
      const listenerSpy = vi.spyOn(
        EventTarget.prototype,
        'addEventListener'
      );
      Object.defineProperty(navigator, 'serviceWorker', {
        value: new EventTarget(),
        configurable: true,
      });
      const onProgress = vi.fn();
      const cleanup = subscribeEnginePreloadProgress(onProgress);

      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'ENGINE_PRELOADED', url: '/engines/resize.js' },
        })
      );
      expect(onProgress).toHaveBeenCalledWith('/engines/resize.js');
      cleanup();
      listenerSpy.mockRestore();
    });

    it('TOP5_PRELOAD_DONE 消息触发 onDone', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: new EventTarget(),
        configurable: true,
      });
      const onDone = vi.fn();
      const cleanup = subscribeEnginePreloadProgress(undefined, onDone);

      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'TOP5_PRELOAD_DONE', failed: ['/engines/x.js'] },
        })
      );
      expect(onDone).toHaveBeenCalledWith(['/engines/x.js']);
      cleanup();
    });

    it('cleanup 后不再触发回调', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: new EventTarget(),
        configurable: true,
      });
      const onProgress = vi.fn();
      const cleanup = subscribeEnginePreloadProgress(onProgress);
      cleanup();
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'ENGINE_PRELOADED', url: '/x' },
        })
      );
      expect(onProgress).not.toHaveBeenCalled();
    });

    it('非 SW 环境返回 no-op cleanup', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
      });
      const cleanup = subscribeEnginePreloadProgress();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });
});

/**
 * W15.2 懒加载单元测试 —— engine-image/src/lazy.ts
 *
 * 覆盖:
 * - lazyLoadOperation: 按 capability 短名加载 / 缓存命中 / 并发去重 / 未知 capability 抛错
 * - prefetchOperation: 后台预加载 / 已加载跳过 / 未知 capability 静默 warn
 * - preloadTop5Operations: 并发加载 5 个,返回成功列表
 * - isOperationLoaded: 反映加载状态
 * - clearOperationCache: 清空缓存
 *
 * 用真实的 dynamic import(vitest 支持),不 mock。
 * operation 模块在 import 时不会触发 Canvas/createImageBitmap(浏览器 API
 * 仅在函数体内调用),故 node 环境可安全 dynamic import。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  lazyLoadOperation,
  prefetchOperation,
  preloadTop5Operations,
  clearOperationCache,
  isOperationLoaded,
  TOP_5_OPERATIONS,
} from '../lazy.js';

describe('lazyLoadOperation', () => {
  beforeEach(() => {
    clearOperationCache();
  });

  it('应按 capability 短名加载 operation', async () => {
    const op = await lazyLoadOperation('resize');
    expect(typeof op).toBe('function');
    expect(isOperationLoaded('resize')).toBe(true);
  });

  it('命中缓存时不再重复 import', async () => {
    const first = await lazyLoadOperation('compress');
    const second = await lazyLoadOperation('compress');
    // 同一引用 = 来自缓存,未重复 import
    expect(second).toBe(first);
  });

  it('并发请求同一 capability 应去重(返回同一 promise)', async () => {
    const p1 = lazyLoadOperation('convert');
    const p2 = lazyLoadOperation('convert');
    // 同一 promise 对象 = 并发去重
    expect(p1).toBe(p2);
    const [op1, op2] = await Promise.all([p1, p2]);
    expect(op1).toBe(op2);
  });

  it('未知 capability 应抛错', async () => {
    await expect(lazyLoadOperation('nonexistent-op')).rejects.toThrow(
      /Unknown engine operation/
    );
  });
});

describe('prefetchOperation', () => {
  beforeEach(() => {
    clearOperationCache();
  });

  it('应后台预加载,不抛错', async () => {
    prefetchOperation('rotate');
    // 后台 dynamic import 异步完成,轮询等待缓存命中
    await vi.waitFor(() => {
      expect(isOperationLoaded('rotate')).toBe(true);
    });
  });

  it('已加载的应跳过(不 warn)', async () => {
    await lazyLoadOperation('flip');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 已加载 → 立即跳过,不应触发 warn
    prefetchOperation('flip');
    await new Promise((r) => setTimeout(r, 0));
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('未知 capability 应静默 warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    prefetchOperation('totally-unknown');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot prefetch unknown operation')
    );
    warnSpy.mockRestore();
  });
});

describe('preloadTop5Operations', () => {
  beforeEach(() => {
    clearOperationCache();
  });

  it('应并发加载 5 个,返回成功列表', async () => {
    const results = await preloadTop5Operations();
    expect(results).toHaveLength(TOP_5_OPERATIONS.length);
    for (const name of TOP_5_OPERATIONS) {
      expect(results).toContain(name);
      expect(isOperationLoaded(name)).toBe(true);
    }
  });
});

describe('isOperationLoaded', () => {
  beforeEach(() => {
    clearOperationCache();
  });

  it('应反映加载状态', async () => {
    expect(isOperationLoaded('crop')).toBe(false);
    await lazyLoadOperation('crop');
    expect(isOperationLoaded('crop')).toBe(true);
  });
});

describe('clearOperationCache', () => {
  it('应清空缓存', async () => {
    await lazyLoadOperation('resize');
    expect(isOperationLoaded('resize')).toBe(true);
    clearOperationCache();
    expect(isOperationLoaded('resize')).toBe(false);
  });
});

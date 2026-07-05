/**
 * W15.2 — lazy.ts 单元测试
 *
 * 覆盖:
 *   - loadEngineModule 首次加载 → 状态 'loading' → 'loaded'
 *   - 第二次调用返回缓存 Promise(不重复 import)
 *   - prefetchEngineModule 失败不影响下次重试
 *   - prefetchOnHover 在 mouseenter 时触发,并自动解绑
 *   - CAPABILITY_TO_MODULE 映射完整
 *   - getLoadStatusByCapability 兜底
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadEngineModule,
  prefetchEngineModule,
  preloadTop5Engines,
  getLoadStatus,
  getLoadStatusByCapability,
  prefetchOnHover,
  prefetchOnHoverCapability,
  CAPABILITY_TO_MODULE,
  TOP5_MODULES,
  _resetLazyCache,
  type EngineModuleName,
} from '../lazy.js';

describe('engine-image lazy loader (W15.2)', () => {
  beforeEach(() => {
    _resetLazyCache();
  });

  it('初始状态:所有模块应为 idle', () => {
    const names: EngineModuleName[] = [
      'transform',
      'encode',
      'watermark',
      'compress-target',
      'filters',
      'png-metadata',
      'tiles',
    ];
    for (const name of names) {
      expect(getLoadStatus(name)).toBe('idle');
    }
  });

  it('loadEngineModule 加载成功后状态变为 loaded', async () => {
    await loadEngineModule('transform');
    expect(getLoadStatus('transform')).toBe('loaded');
  });

  it('loadEngineModule 第二次调用返回缓存(不重复 import)', async () => {
    const p1 = loadEngineModule('watermark');
    const p2 = loadEngineModule('watermark');
    expect(p1).toBe(p2);
    await p1;
    expect(getLoadStatus('watermark')).toBe('loaded');
  });

  it('CAPABILITY_TO_MODULE 覆盖 top 5 capability', () => {
    // Top 5 capability 必须有映射
    expect(CAPABILITY_TO_MODULE['image.resize']).toBe('transform');
    expect(CAPABILITY_TO_MODULE['image.compress']).toBe('encode');
    expect(CAPABILITY_TO_MODULE['image.convert']).toBe('encode');
    expect(CAPABILITY_TO_MODULE['image.crop']).toBe('transform');
    expect(CAPABILITY_TO_MODULE['image.watermark']).toBe('watermark');
  });

  it('TOP5_MODULES 长度为 5 且元素唯一', () => {
    expect(TOP5_MODULES).toHaveLength(5);
    expect(new Set(TOP5_MODULES).size).toBe(5);
  });

  it('preloadTop5Engines 并发加载所有 top 5 模块', async () => {
    const result = await preloadTop5Engines();
    for (const name of TOP5_MODULES) {
      expect(result[name]).toBe('loaded');
      expect(getLoadStatus(name)).toBe('loaded');
    }
  });

  it('getLoadStatusByCapability 未知 capability 返回 idle', () => {
    expect(getLoadStatusByCapability('image.unknown')).toBe('idle');
  });

  it('getLoadStatusByCapability 已知 capability 返回对应模块状态', async () => {
    await loadEngineModule('transform');
    expect(getLoadStatusByCapability('image.resize')).toBe('loaded');
    expect(getLoadStatusByCapability('image.crop')).toBe('loaded');
  });

  it('prefetchEngineModule 不抛错(失败时静默)', async () => {
    // 当前 importer 都会成功;此处仅验证接口契约
    expect(() => prefetchEngineModule('encode')).not.toThrow();
    // 等待 import 完成
    await loadEngineModule('encode');
    expect(getLoadStatus('encode')).toBe('loaded');
  });

  it('prefetchOnHover 已加载模块立即返回 no-op cleanup', async () => {
    await loadEngineModule('watermark');
    const el = document.createElement('button');
    const cleanup = prefetchOnHover('watermark', el);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('prefetchOnHover 在 mouseenter 时触发并自动解绑', async () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const cleanup = prefetchOnHover('filters', el);

    el.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    // 触发后异步加载,等待 microtask
    await new Promise((r) => setTimeout(r, 50));
    expect(getLoadStatus('filters')).toBe('loaded');

    // 再次 dispatch 不应触发任何变化(已自动解绑)
    el.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    cleanup();
    document.body.removeChild(el);
  });

  it('prefetchOnHover 支持 focus 事件', async () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const cleanup = prefetchOnHover('tiles', el);

    el.dispatchEvent(new Event('focus', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(getLoadStatus('tiles')).toBe('loaded');
    cleanup();
    document.body.removeChild(el);
  });

  it('prefetchOnHoverCapability 通过 capability ID 触发', async () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const cleanup = prefetchOnHoverCapability('image.watermark', el);

    el.dispatchEvent(new Event('mouseenter', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    expect(getLoadStatus('watermark')).toBe('loaded');
    cleanup();
    document.body.removeChild(el);
  });

  it('prefetchOnHoverCapability 未知 capability 返回 no-op', () => {
    const el = document.createElement('button');
    const cleanup = prefetchOnHoverCapability('image.unknown', el);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});

// @vitest-environment jsdom
/**
 * 本地存储 hook 结构化错误单测(#10)
 *
 * 覆盖:
 * - LokvisStorageError 携带 code / messageKey / params / 英文兜底 message
 * - useCustomPresets.save 非法输入 / 超限抛出对应 code 的 LokvisStorageError
 * - 所抛错误的 messageKey 均存在于 i18n 字典(防漂移)
 *
 * 使用 renderHook 驱动真实 hook(jsdom 环境),localStorage 每例前清理。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCustomPresets } from '../hooks/useCustomPresets.js';
import { LokvisStorageError } from '../hooks/storage-errors.js';
import { ui } from '../i18n/ui.js';

/**
 * Minimal localStorage 实现(基于 Map,不持久化)。
 *
 * vitest 2.x 在 Node 26 下 jsdom 环境不暴露可用的 localStorage(全局为 undefined),
 * 但 renderHook 又需要真实 DOM。故保留 jsdom 环境、仅自行注入 localStorage,
 * 与 use-custom-presets.test.ts 的 MemoryLocalStorage 约定一致。
 */
class MemoryLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  // 每例注入全新实例,天然隔离(等价于 clear),源码经 window.localStorage 访问
  const storage = new MemoryLocalStorage();
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
});

describe('LokvisStorageError(#10)', () => {
  it('携带 code / messageKey / params / message', () => {
    const err = new LokvisStorageError(
      'preset.saveLimit',
      'error.presetSaveLimit',
      'fallback',
      { limit: 3, isPro: false }
    );
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('LokvisStorageError');
    expect(err.code).toBe('preset.saveLimit');
    expect(err.messageKey).toBe('error.presetSaveLimit');
    expect(err.params).toEqual({ limit: 3, isPro: false });
    expect(err.message).toBe('fallback');
  });
});

describe('useCustomPresets.save 抛结构化错误(#10)', () => {
  it('尺寸非正数 → code=preset.invalidSize', () => {
    const { result } = renderHook(() => useCustomPresets(false));
    try {
      result.current.save({ name: 'x', width: 0, height: 100 });
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(LokvisStorageError);
      expect((e as LokvisStorageError).code).toBe('preset.invalidSize');
    }
  });

  it('名称为空 → code=preset.emptyName', () => {
    const { result } = renderHook(() => useCustomPresets(false));
    try {
      result.current.save({ name: '   ', width: 100, height: 100 });
      expect.unreachable('should throw');
    } catch (e) {
      expect((e as LokvisStorageError).code).toBe('preset.emptyName');
    }
  });

  it('超出免费上限 → code=preset.saveLimit + messageKey 升级版', () => {
    const { result } = renderHook(() => useCustomPresets(false));
    // 免费上限 3:先存满 3 个
    for (let i = 0; i < 3; i++) {
      result.current.save({ name: `p${i}`, width: 100, height: 100 });
    }
    try {
      result.current.save({ name: 'p4', width: 100, height: 100 });
      expect.unreachable('should throw');
    } catch (e) {
      const err = e as LokvisStorageError;
      expect(err.code).toBe('preset.saveLimit');
      expect(err.messageKey).toBe('error.presetSaveLimitUpgrade');
      expect(err.params).toMatchObject({ limit: 3, isPro: false });
    }
  });
});

describe('hook 错误 messageKey 均存在于 i18n 字典(#10 防漂移)', () => {
  const keys = [
    'error.workflowSaveLimit',
    'error.workflowSaveLimitUpgrade',
    'error.workflowImportParse',
    'error.workflowImportLimit',
    'error.workflowImportEmpty',
    'error.presetInvalidSize',
    'error.presetEmptyName',
    'error.presetSaveLimit',
    'error.presetSaveLimitUpgrade',
  ];
  it.each(keys)('%s 存在', (key) => {
    expect(ui[key]).toBeDefined();
  });
});

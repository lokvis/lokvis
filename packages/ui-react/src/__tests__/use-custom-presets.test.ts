// @vitest-environment jsdom
/**
 * useCustomPresets 单元测试(W17.5)
 *
 * 测试纯函数 readCustomPresetsFromStorage / writeCustomPresetsToStorage /
 * genCustomPresetId + FREE/PRO 限制逻辑(不渲染 React 组件,直接调用导出的纯函数)。
 *
 * 限制检查逻辑通过模拟 save 流程测试:读取当前 → 检查长度 → 写入。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FREE_PRESET_LIMIT,
  PRO_PRESET_LIMIT,
  readCustomPresetsFromStorage,
  writeCustomPresetsToStorage,
  genCustomPresetId,
  type CustomSizePreset,
} from '../hooks/useCustomPresets.js';

describe('useCustomPresets 纯函数(W17.5)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // ─── readCustomPresetsFromStorage ────────────────────
  describe('readCustomPresetsFromStorage', () => {
    it('空 localStorage 返回空数组', () => {
      expect(readCustomPresetsFromStorage()).toEqual([]);
    });

    it('正常 JSON 数组返回全部预设', () => {
      const presets: CustomSizePreset[] = [
        {
          id: 'custom.1',
          name: '方形',
          width: 1080,
          height: 1080,
          fit: 'cover',
          format: 'png',
          createdAt: 1,
          updatedAt: 1,
        },
      ];
      window.localStorage.setItem('lokvis.customPresets', JSON.stringify(presets));
      const result = readCustomPresetsFromStorage();
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('方形');
    });

    it('JSON 解析失败返回空数组(容错)', () => {
      window.localStorage.setItem('lokvis.customPresets', 'not-json');
      expect(readCustomPresetsFromStorage()).toEqual([]);
    });

    it('非数组 JSON 返回空数组', () => {
      window.localStorage.setItem('lokvis.customPresets', '{"key":"value"}');
      expect(readCustomPresetsFromStorage()).toEqual([]);
    });

    it('过滤缺字段的条目', () => {
      const bad = [{ id: 'x', name: '不完整' }];
      window.localStorage.setItem('lokvis.customPresets', JSON.stringify(bad));
      expect(readCustomPresetsFromStorage()).toEqual([]);
    });

    it('过滤非法 fit 值', () => {
      const bad: unknown[] = [
        {
          id: 'custom.1', name: 'x', width: 100, height: 100,
          fit: 'invalid-strategy', createdAt: 1, updatedAt: 1,
        },
      ];
      window.localStorage.setItem('lokvis.customPresets', JSON.stringify(bad));
      expect(readCustomPresetsFromStorage()).toEqual([]);
    });

    it('过滤非法 format 值', () => {
      const bad: unknown[] = [
        {
          id: 'custom.1', name: 'x', width: 100, height: 100,
          fit: 'cover', format: 'gif', createdAt: 1, updatedAt: 1,
        },
      ];
      window.localStorage.setItem('lokvis.customPresets', JSON.stringify(bad));
      expect(readCustomPresetsFromStorage()).toEqual([]);
    });

    it('过滤 width/height 非正数', () => {
      const bad: unknown[] = [
        {
          id: 'custom.1', name: 'x', width: 0, height: 100,
          fit: 'cover', createdAt: 1, updatedAt: 1,
        },
        {
          id: 'custom.2', name: 'y', width: 100, height: -1,
          fit: 'cover', createdAt: 1, updatedAt: 1,
        },
      ];
      window.localStorage.setItem('lokvis.customPresets', JSON.stringify(bad));
      expect(readCustomPresetsFromStorage()).toEqual([]);
    });

    it('format 缺省(undefined)时视为合法', () => {
      const ok: unknown[] = [
        {
          id: 'custom.1', name: 'no-format', width: 100, height: 100,
          fit: 'contain', createdAt: 1, updatedAt: 1,
        },
      ];
      window.localStorage.setItem('lokvis.customPresets', JSON.stringify(ok));
      const result = readCustomPresetsFromStorage();
      expect(result).toHaveLength(1);
      expect(result[0]!.format).toBeUndefined();
    });

    it('混合有效/无效条目时仅返回有效部分', () => {
      const mixed: unknown[] = [
        {
          id: 'custom.1', name: 'valid', width: 100, height: 100,
          fit: 'cover', createdAt: 1, updatedAt: 1,
        },
        { id: 'bad', name: 'incomplete' },
        {
          id: 'custom.2', name: 'also-valid', width: 200, height: 200,
          fit: 'inside', format: 'webp', createdAt: 2, updatedAt: 2,
        },
      ];
      window.localStorage.setItem('lokvis.customPresets', JSON.stringify(mixed));
      const result = readCustomPresetsFromStorage();
      expect(result).toHaveLength(2);
    });
  });

  // ─── writeCustomPresetsToStorage ─────────────────────
  describe('writeCustomPresetsToStorage', () => {
    it('成功写入并返回 true', () => {
      const presets: CustomSizePreset[] = [
        {
          id: 'custom.1', name: 'test', width: 100, height: 100,
          fit: 'cover', createdAt: 1, updatedAt: 1,
        },
      ];
      const ok = writeCustomPresetsToStorage(presets);
      expect(ok).toBe(true);
      const raw = window.localStorage.getItem('lokvis.customPresets');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toHaveLength(1);
    });

    it('写入空数组', () => {
      const ok = writeCustomPresetsToStorage([]);
      expect(ok).toBe(true);
      expect(window.localStorage.getItem('lokvis.customPresets')).toBe('[]');
    });

    it('dispatch SYNC_EVENT 通知同 tab 监听者', () => {
      const handler = vi.fn();
      window.addEventListener('lokvis:custom-presets-change', handler);
      writeCustomPresetsToStorage([]);
      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener('lokvis:custom-presets-change', handler);
    });
  });

  // ─── read + write 往返 ───────────────────────────────
  describe('write → read 往返一致性', () => {
    it('写入后读取还原原始数据', () => {
      const original: CustomSizePreset[] = [
        {
          id: 'custom.1', name: '方形', width: 1080, height: 1080,
          fit: 'cover', format: 'png', createdAt: 100, updatedAt: 200,
        },
        {
          id: 'custom.2', name: '横版', width: 1920, height: 1080,
          fit: 'contain', createdAt: 300, updatedAt: 400,
        },
      ];
      writeCustomPresetsToStorage(original);
      const read = readCustomPresetsFromStorage();
      expect(read).toEqual(original);
    });
  });

  // ─── genCustomPresetId ──────────────────────────────
  describe('genCustomPresetId', () => {
    it('生成 custom. 前缀的 ID', () => {
      const id = genCustomPresetId();
      expect(id.startsWith('custom.')).toBe(true);
    });

    it('多次调用生成不同 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(genCustomPresetId());
      }
      expect(ids.size).toBe(100);
    });
  });

  // ─── Pro 门控常量 ───────────────────────────────────
  describe('Pro 门控常量', () => {
    it('FREE_PRESET_LIMIT = 3', () => {
      expect(FREE_PRESET_LIMIT).toBe(3);
    });

    it('PRO_PRESET_LIMIT = Infinity', () => {
      expect(PRO_PRESET_LIMIT).toBe(Infinity);
    });
  });

  // ─── Free 限制逻辑模拟 ──────────────────────────────
  describe('Free 限制逻辑(模拟 save 流程)', () => {
    it('免费用户:已有 3 个预设时新增应超限', () => {
      // 先写入 3 个(达到免费上限)
      const existing: CustomSizePreset[] = Array.from({ length: 3 }, (_, i) => ({
        id: `custom.${i}`,
        name: `preset-${i}`,
        width: 100 + i,
        height: 100 + i,
        fit: 'cover' as const,
        createdAt: i,
        updatedAt: i,
      }));
      writeCustomPresetsToStorage(existing);

      // 模拟 save 中的限制检查
      const current = readCustomPresetsFromStorage();
      const limit = FREE_PRESET_LIMIT;
      expect(current.length >= limit).toBe(true);
    });

    it('Pro 用户:已有 3 个预设时仍可新增(Infinity 限制)', () => {
      const existing: CustomSizePreset[] = Array.from({ length: 3 }, (_, i) => ({
        id: `custom.${i}`,
        name: `preset-${i}`,
        width: 100 + i,
        height: 100 + i,
        fit: 'cover' as const,
        createdAt: i,
        updatedAt: i,
      }));
      writeCustomPresetsToStorage(existing);

      const current = readCustomPresetsFromStorage();
      const limit = PRO_PRESET_LIMIT;
      // Infinity 永远大于任意有限数
      expect(current.length < limit).toBe(true);
      expect(current.length >= limit).toBe(false);
    });

    it('免费用户:已有 2 个预设时还可新增 1 个', () => {
      const existing: CustomSizePreset[] = Array.from({ length: 2 }, (_, i) => ({
        id: `custom.${i}`,
        name: `preset-${i}`,
        width: 100,
        height: 100,
        fit: 'cover' as const,
        createdAt: i,
        updatedAt: i,
      }));
      writeCustomPresetsToStorage(existing);

      const current = readCustomPresetsFromStorage();
      const limit = FREE_PRESET_LIMIT;
      expect(current.length < limit).toBe(true); // 2 < 3,可新增
    });
  });
});

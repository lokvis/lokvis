/**
 * useCustomPresets - 自定义尺寸预设持久化 hook(W17.5)
 *
 * 提供用户自定义图像尺寸预设的本地保存能力(免费 3 / Pro 无限)。
 * 数据存储在 localStorage 的 `lokvis.customPresets` key,JSON 数组形式。
 *
 * 与 useWorkflows 的区别:
 *   - 自定义预设是尺寸配置(name/width/height/fit/format),轻量
 *   - 工作流槽位是完整 Workflow 定义(含 nodes/edges/inputs/outputs)
 *
 * 与 PLATFORM_PRESETS 的区别:
 *   - PLATFORM_PRESETS 是内置的固定预设(YouTube/TikTok 等平台标准尺寸)
 *   - 自定义预设是用户自建的任意尺寸配置,自由命名
 *
 * id 命名空间约定:自定义预设 id 以 `custom.` 前缀,与内置预设区分
 * (如 `custom.my-instagram-square`),避免 PlatformPresetSelector 冲突。
 *
 * 多 tab / 多实例同步:
 *   - 原生 storage 事件:跨 tab 同步
 *   - 自定义 SYNC_EVENT:同 tab 多实例同步
 *
 * @module useCustomPresets
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  PlatformFitStrategy,
  PlatformRecommendedFormat,
} from '@lokvis/capability';

const STORAGE_KEY = 'lokvis.customPresets';
/** 同 tab 多实例同步用的自定义事件名 */
const SYNC_EVENT = 'lokvis:custom-presets-change';

/** 免费用户自定义预设上限 */
export const FREE_PRESET_LIMIT = 3;
/** Pro 用户无上限 */
export const PRO_PRESET_LIMIT = Infinity;

/** 自定义尺寸预设存储格式 */
export interface CustomSizePreset {
  /** 唯一 ID,以 `custom.` 前缀 */
  id: string;
  /** 用户自定义名称(如 "我的方形预设") */
  name: string;
  /** 目标宽度(像素) */
  width: number;
  /** 目标高度(像素) */
  height: number;
  /** fit 策略(默认 cover) */
  fit: PlatformFitStrategy;
  /** 推荐输出格式(可选) */
  format?: PlatformRecommendedFormat;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
}

/** 保存预设时的输入(不含 id / 时间戳,由 save 自动生成) */
export interface SavePresetInput {
  /** 预设名称 */
  name: string;
  /** 目标宽度(像素,>0) */
  width: number;
  /** 目标高度(像素,>0) */
  height: number;
  /** fit 策略(默认 cover) */
  fit?: PlatformFitStrategy;
  /** 推荐输出格式(可选) */
  format?: PlatformRecommendedFormat;
  /** 若指定则更新该 id 的预设,否则新增 */
  id?: string;
}

export interface UseCustomPresetsResult {
  /** 当前所有自定义预设(按 updatedAt 降序) */
  presets: CustomSizePreset[];
  /** 保存或更新预设;超限时抛 Error */
  save(input: SavePresetInput): CustomSizePreset;
  /** 按 id 删除预设 */
  remove(id: string): void;
  /** 按 id 查找预设 */
  get(id: string): CustomSizePreset | null;
  /** 当前上限(免费 3 / Pro 无限) */
  limit: number;
  /** 是否还能再保存 */
  canSaveMore: boolean;
  /** 还能再保存多少个 */
  remaining: number;
}

/** 类型守卫:判断 unknown 是否为 Record<string, unknown> */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

const VALID_FIT_STRATEGIES: readonly PlatformFitStrategy[] = ['cover', 'contain', 'fill', 'inside', 'outside'];
const VALID_FORMATS: readonly PlatformRecommendedFormat[] = ['png', 'jpeg', 'webp'];

/** 从 localStorage 读取自定义预设。
 * 容错:JSON 解析失败 / 非数组 / 字段缺失时返回空数组。
 *
 * 导出供测试直接调用(避免渲染 React 组件)。 */
export function readCustomPresetsFromStorage(): CustomSizePreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 字段白名单过滤(防御损坏数据)
    const result = parsed.filter((it): it is CustomSizePreset => {
      if (!isRecord(it)) return false;
      if (
        typeof it.id !== 'string' ||
        typeof it.name !== 'string' ||
        typeof it.width !== 'number' ||
        typeof it.height !== 'number' ||
        typeof it.fit !== 'string' ||
        typeof it.createdAt !== 'number' ||
        typeof it.updatedAt !== 'number'
      ) {
        return false;
      }
      // id 必须以 custom. 前缀开头,与内置 PLATFORM_PRESETS 隔离
      if (!it.id.startsWith('custom.')) return false;
      // fit 必须是合法值
      if (!VALID_FIT_STRATEGIES.includes(it.fit as PlatformFitStrategy)) {
        return false;
      }
      // format 可选,若有则必须是合法值
      if (it.format !== undefined && !VALID_FORMATS.includes(it.format as PlatformRecommendedFormat)) {
        return false;
      }
      // width / height 必须为正整数
      if (it.width <= 0 || it.height <= 0) return false;
      return true;
    });
    // 按 updatedAt 降序(最新在前),与接口契约一致
    result.sort((a, b) => b.updatedAt - a.updatedAt);
    return result;
  } catch {
    console.warn('[lokvis] Failed to read custom presets from storage');
    return [];
  }
}

/**
 * 写入 localStorage。
 * @returns true 成功;false 失败(隐私模式 / 配额超限 / 序列化异常)
 *
 * 导出供测试直接调用。
 */
export function writeCustomPresetsToStorage(presets: CustomSizePreset[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    return true;
  } catch (err) {
    console.warn('[lokvis] Failed to persist custom presets to localStorage:', err);
    return false;
  }
}

/** 生成唯一 ID(custom. 前缀,与内置预设命名空间隔离) */
export function genCustomPresetId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `custom.${Date.now()}-${rand}`;
}

/**
 * @param isPro 是否为 Pro 模式。父组件从 runtime.isPro 传入。
 * 影响 limit:免费 3 / Pro 无上限。
 */
export function useCustomPresets(isPro = false): UseCustomPresetsResult {
  const limit = isPro ? PRO_PRESET_LIMIT : FREE_PRESET_LIMIT;
  const [presets, setPresets] = useState<CustomSizePreset[]>(() =>
    readCustomPresetsFromStorage()
  );

  // 监听跨 tab storage + 同 tab SYNC_EVENT
  useEffect(() => {
    const handler = () => setPresets(readCustomPresetsFromStorage());
    window.addEventListener('storage', handler);
    window.addEventListener(SYNC_EVENT, handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener(SYNC_EVENT, handler);
    };
  }, []);

  const save = useCallback(
    (input: SavePresetInput): CustomSizePreset => {
      // 输入校验
      if (input.width <= 0 || input.height <= 0) {
        throw new Error('预设尺寸必须为正数');
      }
      if (!input.name.trim()) {
        throw new Error('预设名称不能为空');
      }

      const current = readCustomPresetsFromStorage();
      const now = Date.now();

      // 更新已有
      if (input.id) {
        const existing = current.find((p) => p.id === input.id);
        if (existing) {
          const updated: CustomSizePreset = {
            ...existing,
            name: input.name,
            width: input.width,
            height: input.height,
            fit: input.fit ?? existing.fit,
            format: input.format ?? existing.format,
            updatedAt: now,
          };
          const next = current.map((p) => (p.id === input.id ? updated : p));
          const ok = writeCustomPresetsToStorage(next);
          if (!ok) {
            console.warn('[lokvis] 自定义预设未持久化到 localStorage,仅当前会话有效');
          }
          setPresets(next);
          return updated;
        }
      }

      // 新增
      if (current.length >= limit) {
        throw new Error(
          `自定义预设已达上限(${limit} 个)${isPro ? '' : ',升级 Pro 可无限制保存'}`
        );
      }
      const preset: CustomSizePreset = {
        id: genCustomPresetId(),
        name: input.name,
        width: input.width,
        height: input.height,
        fit: input.fit ?? 'cover',
        format: input.format,
        createdAt: now,
        updatedAt: now,
      };
      const next = [...current, preset];
      const ok = writeCustomPresetsToStorage(next);
      if (!ok) {
        console.warn('[lokvis] 自定义预设未持久化到 localStorage,仅当前会话有效');
      }
      setPresets(next);
      return preset;
    },
    [limit, isPro]
  );

  const remove = useCallback((id: string) => {
    const current = readCustomPresetsFromStorage();
    const next = current.filter((p) => p.id !== id);
    const ok = writeCustomPresetsToStorage(next);
    if (!ok) {
      console.warn('[lokvis] Failed to persist custom presets removal');
    }
    setPresets(next);
  }, []);

  const get = useCallback((id: string): CustomSizePreset | null => {
    const current = readCustomPresetsFromStorage();
    return current.find((p) => p.id === id) ?? null;
  }, []);

  const canSaveMore = presets.length < limit;
  const remaining = Math.max(0, limit - presets.length);

  return {
    presets,
    save,
    remove,
    get,
    limit,
    canSaveMore,
    remaining,
  };
}

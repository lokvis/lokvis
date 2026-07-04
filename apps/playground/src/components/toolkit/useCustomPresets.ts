/**
 * useCustomPresets — 用户自定义尺寸预设的 localStorage 持久化 hook(W8.3)。
 *
 * 免费用户上限 3 个,Pro 用户无限制(由 runtime.isPro 决定)。
 * 数据存储在 localStorage 的 `lokvis.custom-presets` key,JSON 数组形式。
 *
 * 与 PlatformPresetSelector 配合使用:选择器把自定义预设合并到 'other'
 * 分组末尾展示,并提供"保存当前表单为新预设"按钮。
 *
 * 设计要点:
 * - 多组件实例共享同一份 localStorage:用 storage 事件 + 内部 state 同步
 * - ID 用 `${Date.now()}-${randomStr}` 保证唯一
 * - 保存超限时抛 Error,选择器通过 canSaveMore 提前禁用按钮
 */
import { useCallback, useEffect, useState } from 'react';
import type { PlatformFitStrategy, PlatformRecommendedFormat } from '@lokvis/capability';

const STORAGE_KEY = 'lokvis.custom-presets';

/** 免费用户自定义预设上限 */
export const FREE_CUSTOM_PRESET_LIMIT = 3;
/** Pro 用户无上限(用 Number.MAX_SAFE_INTEGER 表"无限") */
export const PRO_CUSTOM_PRESET_LIMIT = Number.MAX_SAFE_INTEGER;

/** 自定义预设存储格式 */
export interface CustomPreset {
  /** 唯一 ID(Date.now + random) */
  id: string;
  /** 用户输入的名称 */
  name: string;
  /** 目标宽度(像素) */
  width: number;
  /** 目标高度(像素) */
  height: number;
  /** 推荐 fit 策略(可选) */
  fit?: PlatformFitStrategy;
  /** 推荐输出格式(可选) */
  format?: PlatformRecommendedFormat;
  /** 创建时间戳 */
  createdAt: number;
}

/** 保存预设时的输入(不带 id/createdAt,由 save 自动生成) */
export interface CustomPresetInput {
  name: string;
  width: number;
  height: number;
  fit?: PlatformFitStrategy;
  format?: PlatformRecommendedFormat;
}

/**
 * 从 localStorage 读取自定义预设。
 *
 * 容错:JSON 解析失败 / 非数组 / 字段缺失时返回空数组,不抛错。
 * 这样旧版本数据格式损坏不会阻塞 UI。
 */
function readFromStorage(): CustomPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 字段白名单过滤:剔除格式不符的条目
    return parsed.filter((it): it is CustomPreset => {
      if (!it || typeof it !== 'object') return false;
      const p = it as Record<string, unknown>;
      return (
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        typeof p.width === 'number' &&
        typeof p.height === 'number' &&
        typeof p.createdAt === 'number'
      );
    });
  } catch {
    return [];
  }
}

/** 写入 localStorage(失败静默 —— 隐私模式下 localStorage 可能不可用) */
function writeToStorage(presets: CustomPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    // 触发 storage 事件让同源其他 tab 同步(window.setItem 不会在本 tab 触发 storage 事件)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  } catch {
    /* 静默 */
  }
}

/** 生成唯一 ID */
function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseCustomPresetsResult {
  /** 当前所有自定义预设(按 createdAt 升序) */
  presets: CustomPreset[];
  /** 保存新预设;超限时抛 Error */
  save: (input: CustomPresetInput) => CustomPreset;
  /** 按 id 删除预设 */
  remove: (id: string) => void;
  /** 当前上限(免费 3 / Pro 无限) */
  limit: number;
  /** 是否还能再保存 */
  canSaveMore: boolean;
  /** 还能再保存多少个(Pro 永远返回大数,UI 显示用 isPro 判断更准确) */
  remaining: number;
}

/**
 * @param isPro 是否为 Pro 模式。父组件从 runtime.isPro 传入。
 * 影响 limit:免费 3 / Pro 无上限。
 */
export function useCustomPresets(isPro = false): UseCustomPresetsResult {
  const limit = isPro ? PRO_CUSTOM_PRESET_LIMIT : FREE_CUSTOM_PRESET_LIMIT;
  const [presets, setPresets] = useState<CustomPreset[]>(() => readFromStorage());

  // 监听 storage 事件:同源其他 tab 修改 localStorage 时同步
  // 同时本 tab 的 writeToStorage 也会手动 dispatch storage 事件,
  // 让多个 useCustomPresets 实例(如 resize/crop 工具页同时打开)状态一致。
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      setPresets(readFromStorage());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const save = useCallback(
    (input: CustomPresetInput): CustomPreset => {
      const current = readFromStorage();
      if (current.length >= limit) {
        throw new Error(
          `自定义预设已达上限(${limit} 个)${isPro ? '' : ',升级 Pro 可无限制保存'}`
        );
      }
      const preset: CustomPreset = {
        id: genId(),
        name: input.name,
        width: input.width,
        height: input.height,
        fit: input.fit,
        format: input.format,
        createdAt: Date.now(),
      };
      const next = [...current, preset];
      writeToStorage(next);
      setPresets(next);
      return preset;
    },
    [limit, isPro]
  );

  const remove = useCallback((id: string) => {
    const current = readFromStorage();
    const next = current.filter((p) => p.id !== id);
    writeToStorage(next);
    setPresets(next);
  }, []);

  const canSaveMore = presets.length < limit;
  const remaining = Math.max(0, limit - presets.length);

  return { presets, save, remove, limit, canSaveMore, remaining };
}

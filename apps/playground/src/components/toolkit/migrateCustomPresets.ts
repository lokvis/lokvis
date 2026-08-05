/**
 * 一次性迁移:playground 旧版 useCustomPresets(W8.3)使用 localStorage key
 * `lokvis.custom-presets`,与 @lokvis/ui-react 版(W17.5)的 `lokvis.customPresets`
 * 不一致,两份数据互不可见(FO-01)。
 *
 * 迁移策略(幂等,playground 启动时执行一次):
 *   1. 读取旧 key 数据(JSON 数组,字段:id/name/width/height/fit?/format?/createdAt)
 *   2. 转换为 ui-react 格式:id 加 `custom.` 前缀、fit 缺省 'cover'、补 updatedAt
 *   3. 与现有新 key 数据合并(按 name+width+height 去重,避免重复迁移产生副本)
 *   4. 写入新 key 并删除旧 key
 *
 * 全程 try/catch:localStorage 不可用(隐私模式)/数据损坏时静默跳过,不阻塞 UI。
 */
import {
  readCustomPresetsFromStorage,
  writeCustomPresetsToStorage,
  type CustomSizePreset,
} from '@lokvis/ui-react';

const LEGACY_KEY = 'lokvis.custom-presets';

interface LegacyPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  fit?: CustomSizePreset['fit'];
  format?: CustomSizePreset['format'];
  createdAt: number;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function readLegacy(): LegacyPreset[] {
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((it): it is LegacyPreset => {
    if (!isRecord(it)) return false;
    return (
      typeof it.id === 'string' &&
      typeof it.name === 'string' &&
      typeof it.width === 'number' &&
      it.width > 0 &&
      typeof it.height === 'number' &&
      it.height > 0 &&
      typeof it.createdAt === 'number'
    );
  });
}

/** 执行迁移;无旧数据或迁移失败时均为 no-op */
export function migrateLegacyCustomPresets(): void {
  if (typeof window === 'undefined') return;
  try {
    const legacy = readLegacy();
    if (legacy.length === 0) {
      // 旧 key 存在但为空/损坏:直接清理
      window.localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const current = readCustomPresetsFromStorage();
    const signature = (p: { name: string; width: number; height: number }) =>
      `${p.name}\u0000${p.width}\u0000${p.height}`;
    const existing = new Set(current.map(signature));
    const migrated: CustomSizePreset[] = [];
    for (const p of legacy) {
      if (existing.has(signature(p))) continue;
      migrated.push({
        id: `custom.${p.id}`,
        name: p.name,
        width: p.width,
        height: p.height,
        fit: p.fit ?? 'cover',
        format: p.format,
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
      });
    }
    if (migrated.length > 0) {
      const ok = writeCustomPresetsToStorage([...current, ...migrated]);
      // 写入失败(隐私模式等)时保留旧 key,下次启动可重试
      if (!ok) return;
    }
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // 数据损坏或 localStorage 异常:跳过迁移,不阻塞 UI
  }
}

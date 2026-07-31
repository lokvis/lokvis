/**
 * 平台尺寸预设库(W8.1)
 *
 * 提供 20+ 主流平台的图像尺寸预设(YouTube/TikTok/IG/Shopify/Etsy/Twitter/
 * LinkedIn 等),供 resize/crop 工具页的"平台预设选择器"使用,让用户一键
 * 选择目标平台的推荐尺寸,而非手动查文档输入 width/height。
 *
 * 数据来源(C1 架构 v2):
 * - `PLATFORM_PRESETS` 由 `scripts/codegen-platform-presets.ts` 生成,事实源为
 *   `@lokvis/data-platforms`(lokvis-knowledge 仓,Knowledge 存 Facts 铁律)与
 *   `platform-manual.ts`(知识仓暂未收录的长尾平台过渡数据)。详见
 *   `platform.generated.ts` 顶部说明。重跑:`pnpm codegen`。
 * - 尺寸以知识仓为唯一权威;新增/修正平台尺寸应优先向 lokvis-knowledge 仓提交
 *   带官方来源的数据,而非手工硬编码。
 *
 * 设计要点:
 * - 每个预设包含 id / platform / name / width / height / category / 可选描述 / source
 * - id 全局唯一(`${platform}.${useCase}`),供选择器 value 与自定义预设区分
 * - category 用于按用途分组(社媒 / 电商 / 视频 / 打印 / 通用)
 * - 不绑定具体 Capability:同一预设可用于 resize(fit)或 crop(居中裁剪)
 *
 * 注:不依赖 @lokvis/engine-image 的 FitStrategy 类型(六层架构单向依赖,
 * capability 包只依赖 schema)。FitStrategy 取值与 engine-image 的同名类型
 * 一致(由 IMAGE_RESIZE.params.fit enum values 定义),保持字符串字面量对齐即可。
 */

export type {
  PlatformPresetCategory,
  PlatformRecommendedFormat,
  PlatformFitStrategy,
  PlatformPresetSource,
  PlatformSizePreset,
} from './platform-types.js';

import type { PlatformPresetCategory, PlatformSizePreset } from './platform-types.js';
import { PLATFORM_PRESETS } from './platform.generated.js';

export { PLATFORM_PRESETS };

/** 平台预设分类标签(供选择器分组标题展示) */
export const PLATFORM_PRESET_CATEGORY_LABELS: Record<PlatformPresetCategory, string> = {
  social: '社媒',
  ecommerce: '电商',
  video: '视频',
  print: '打印',
  other: '通用',
};

/**
 * 按 category 分组返回预设(供选择器 optgroup 使用)。
 *
 * 同 category 内保持原始顺序(同平台相邻),便于用户按平台查找。
 */
export function groupPlatformPresetsByCategory(
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): Map<PlatformPresetCategory, PlatformSizePreset[]> {
  const groups = new Map<PlatformPresetCategory, PlatformSizePreset[]>();
  for (const preset of presets) {
    const arr = groups.get(preset.category);
    if (arr) arr.push(preset);
    else groups.set(preset.category, [preset]);
  }
  return groups;
}

/**
 * 按平台名分组返回预设(供"先选平台,再选尺寸"的两级选择器使用)。
 */
export function groupPlatformPresetsByPlatform(
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): Map<string, PlatformSizePreset[]> {
  const groups = new Map<string, PlatformSizePreset[]>();
  for (const preset of presets) {
    const arr = groups.get(preset.platform);
    if (arr) arr.push(preset);
    else groups.set(preset.platform, [preset]);
  }
  return groups;
}

/** 按 id 查找预设 */
export function findPlatformPreset(
  id: string,
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): PlatformSizePreset | undefined {
  return presets.find((p) => p.id === id);
}

/**
 * 列出所有平台名(去重,保持首次出现顺序)。
 *
 * 供"先选平台,再选尺寸"的两级选择器使用。
 */
export function listPlatforms(
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const preset of presets) {
    if (!seen.has(preset.platform)) {
      seen.add(preset.platform);
      out.push(preset.platform);
    }
  }
  return out;
}

/**
 * 平台尺寸预设库(W8.1)单元测试 —— W8.9
 *
 * 校验 PLATFORM_PRESETS 数据完整性与辅助函数行为:
 * - 字段必填 + 类型/取值合法
 * - id 全局唯一(避免选择器 value 冲突)
 * - 至少覆盖 20+ 平台 / 60+ 预设(符合 PROJECT_PLAN W8.1 验收标准)
 * - 五大 category 均非空(social / ecommerce / video / print / other)
 * - 推荐格式 / fit 取值合法
 * - groupPlatformPresetsByCategory / byPlatform / findPlatformPreset / listPlatforms 行为正确
 */
import { describe, it, expect } from 'vitest';
import {
  PLATFORM_PRESETS,
  PLATFORM_PRESET_CATEGORY_LABELS,
  groupPlatformPresetsByCategory,
  groupPlatformPresetsByPlatform,
  findPlatformPreset,
  listPlatforms,
  type PlatformSizePreset,
  type PlatformPresetCategory,
  type PlatformFitStrategy,
  type PlatformRecommendedFormat,
} from '../presets/platform.js';

const VALID_CATEGORIES: PlatformPresetCategory[] = [
  'social',
  'ecommerce',
  'video',
  'print',
  'other',
];
const VALID_FITS: PlatformFitStrategy[] = [
  'cover',
  'contain',
  'fill',
  'inside',
  'outside',
];
const VALID_FORMATS: PlatformRecommendedFormat[] = ['png', 'jpeg', 'webp'];

// ─── 数据完整性 ────────────────────────────────────────────────

describe('PLATFORM_PRESETS 数据完整性', () => {
  it('应至少有 60 个预设(W8.1 验收标准:20+ 平台 × 多尺寸)', () => {
    expect(PLATFORM_PRESETS.length).toBeGreaterThanOrEqual(60);
  });

  it('应至少覆盖 20 个不同平台(W8.1 验收标准)', () => {
    const platforms = listPlatforms(PLATFORM_PRESETS);
    expect(platforms.length).toBeGreaterThanOrEqual(20);
  });

  it('所有预设字段必填:id / platform / name / width / height / category', () => {
    for (const p of PLATFORM_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.platform).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.width).toBe('number');
      expect(typeof p.height).toBe('number');
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(VALID_CATEGORIES).toContain(p.category);
    }
  });

  it('所有 id 应全局唯一', () => {
    const ids = PLATFORM_PRESETS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('所有 id 应为 `${platform-slug}.${useCase}` 格式(含点号)', () => {
    for (const p of PLATFORM_PRESETS) {
      expect(p.id).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/);
    }
  });

  it('recommendedFit(若提供)应取值合法', () => {
    for (const p of PLATFORM_PRESETS) {
      if (p.recommendedFit !== undefined) {
        expect(VALID_FITS).toContain(p.recommendedFit);
      }
    }
  });

  it('recommendedFormat(若提供)应取值合法', () => {
    for (const p of PLATFORM_PRESETS) {
      if (p.recommendedFormat !== undefined) {
        expect(VALID_FORMATS).toContain(p.recommendedFormat);
      }
    }
  });

  it('五大 category 均应有至少 1 个预设', () => {
    const grouped = groupPlatformPresetsByCategory(PLATFORM_PRESETS);
    for (const cat of VALID_CATEGORIES) {
      const arr = grouped.get(cat);
      expect(arr, `category "${cat}" 不应为空`).toBeDefined();
      expect(arr!.length).toBeGreaterThan(0);
    }
  });

  it('打印类预设应推荐 PNG(避免 JPEG 损失)', () => {
    const printPresets = PLATFORM_PRESETS.filter((p) => p.category === 'print');
    expect(printPresets.length).toBeGreaterThan(0);
    // 多数 print 预设应推荐 PNG(允许个别相片用 JPEG)
    const pngCount = printPresets.filter((p) => p.recommendedFormat === 'png').length;
    expect(pngCount).toBeGreaterThan(printPresets.length / 2);
  });
});

// ─── 辅助函数 ─────────────────────────────────────────────────

describe('groupPlatformPresetsByCategory', () => {
  it('应返回 Map,键为合法 category', () => {
    const grouped = groupPlatformPresetsByCategory();
    expect(grouped).toBeInstanceOf(Map);
    for (const key of grouped.keys()) {
      expect(VALID_CATEGORIES).toContain(key);
    }
  });

  it('分组内顺序应与原数组顺序一致(同平台相邻)', () => {
    const input: PlatformSizePreset[] = [
      { id: 'a.x', platform: 'A', name: 'X', width: 100, height: 100, category: 'social' },
      { id: 'a.y', platform: 'A', name: 'Y', width: 200, height: 200, category: 'social' },
      { id: 'b.x', platform: 'B', name: 'X', width: 300, height: 300, category: 'print' },
    ];
    const grouped = groupPlatformPresetsByCategory(input);
    expect(grouped.get('social')!.map((p) => p.id)).toEqual(['a.x', 'a.y']);
    expect(grouped.get('print')!.map((p) => p.id)).toEqual(['b.x']);
  });

  it('未出现的 category 不应在 Map 中', () => {
    const input: PlatformSizePreset[] = [
      { id: 'a.x', platform: 'A', name: 'X', width: 100, height: 100, category: 'social' },
    ];
    const grouped = groupPlatformPresetsByCategory(input);
    expect(grouped.has('print')).toBe(false);
    expect(grouped.has('video')).toBe(false);
  });

  it('空数组应返回空 Map', () => {
    const grouped = groupPlatformPresetsByCategory([]);
    expect(grouped.size).toBe(0);
  });
});

describe('groupPlatformPresetsByPlatform', () => {
  it('应按 platform 字段分组', () => {
    const grouped = groupPlatformPresetsByPlatform();
    expect(grouped).toBeInstanceOf(Map);
    // 抽样:YouTube 应至少有 1 个预设
    expect(grouped.get('YouTube')!.length).toBeGreaterThan(0);
  });

  it('同 platform 的预设应归入同一组', () => {
    const input: PlatformSizePreset[] = [
      { id: 'a.x', platform: 'A', name: 'X', width: 100, height: 100, category: 'social' },
      { id: 'a.y', platform: 'A', name: 'Y', width: 200, height: 200, category: 'social' },
      { id: 'b.x', platform: 'B', name: 'X', width: 300, height: 300, category: 'print' },
    ];
    const grouped = groupPlatformPresetsByPlatform(input);
    expect(grouped.size).toBe(2);
    expect(grouped.get('A')!.map((p) => p.id)).toEqual(['a.x', 'a.y']);
    expect(grouped.get('B')!.map((p) => p.id)).toEqual(['b.x']);
  });
});

describe('findPlatformPreset', () => {
  it('存在的 id 应返回对应预设', () => {
    const first = PLATFORM_PRESETS[0]!;
    const found = findPlatformPreset(first.id);
    expect(found).toBe(first);
  });

  it('不存在的 id 应返回 undefined', () => {
    expect(findPlatformPreset('nonexistent.id')).toBeUndefined();
  });

  it('应支持自定义预设数组(不从全局查找)', () => {
    const custom: PlatformSizePreset[] = [
      { id: 'custom.x', platform: 'X', name: 'X', width: 100, height: 100, category: 'other' },
    ];
    expect(findPlatformPreset('custom.x', custom)).toBe(custom[0]);
    expect(findPlatformPreset('custom.x')).toBeUndefined();
  });
});

describe('listPlatforms', () => {
  it('应返回去重后的平台名列表', () => {
    const input: PlatformSizePreset[] = [
      { id: 'a.x', platform: 'A', name: 'X', width: 100, height: 100, category: 'social' },
      { id: 'a.y', platform: 'A', name: 'Y', width: 200, height: 200, category: 'social' },
      { id: 'b.x', platform: 'B', name: 'X', width: 300, height: 300, category: 'print' },
    ];
    expect(listPlatforms(input)).toEqual(['A', 'B']);
  });

  it('应保持首次出现顺序(不排序)', () => {
    const input: PlatformSizePreset[] = [
      { id: 'z.x', platform: 'Z', name: 'X', width: 100, height: 100, category: 'social' },
      { id: 'a.x', platform: 'A', name: 'X', width: 100, height: 100, category: 'social' },
      { id: 'z.y', platform: 'Z', name: 'Y', width: 200, height: 200, category: 'social' },
    ];
    expect(listPlatforms(input)).toEqual(['Z', 'A']);
  });
});

// ─── 分类标签 ─────────────────────────────────────────────────

describe('PLATFORM_PRESET_CATEGORY_LABELS', () => {
  it('应覆盖所有 5 个 category', () => {
    for (const cat of VALID_CATEGORIES) {
      expect(PLATFORM_PRESET_CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it('标签应为中文', () => {
    expect(PLATFORM_PRESET_CATEGORY_LABELS.social).toBe('社媒');
    expect(PLATFORM_PRESET_CATEGORY_LABELS.ecommerce).toBe('电商');
    expect(PLATFORM_PRESET_CATEGORY_LABELS.video).toBe('视频');
    expect(PLATFORM_PRESET_CATEGORY_LABELS.print).toBe('打印');
    expect(PLATFORM_PRESET_CATEGORY_LABELS.other).toBe('通用');
  });
});

/**
 * 能力查询/过滤工具单元测试
 */
import { describe, it, expect } from 'vitest';
import type { Capability } from '@lokvis/schema';
import {
  filterByDomain,
  filterByInputType,
  filterByPerformance,
  groupByDomain,
  findCapability,
  isBatchable,
  requiredParams,
  optionalParams,
  defaultParams,
  mergeParams,
  validateParams,
} from '../helpers.js';
import {
  IMAGE_RESIZE,
  IMAGE_COMPRESS,
  PDF_MERGE,
  VIDEO_COMPRESS,
  IMAGE_CROP,
} from '../presets/index.js';

const caps = [IMAGE_RESIZE, IMAGE_COMPRESS, PDF_MERGE, VIDEO_COMPRESS];

describe('filterByDomain', () => {
  it('应过滤出指定领域的能力', () => {
    const result = filterByDomain(caps, 'image');
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.name.startsWith('image.'))).toBe(true);
  });

  it('不匹配的领域应返回空数组', () => {
    expect(filterByDomain(caps, 'audio')).toEqual([]);
  });
});

describe('filterByInputType', () => {
  it('应过滤出接受指定输入类型的能力', () => {
    const result = filterByInputType(caps, 'image');
    expect(result).toHaveLength(2);
  });

  it('pdf 输入应只匹配 PDF_MERGE', () => {
    const result = filterByInputType(caps, 'pdf');
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('pdf.merge');
  });
});

describe('filterByPerformance', () => {
  it('应按性能等级过滤', () => {
    const fast = filterByPerformance(caps, 'fast');
    const slow = filterByPerformance(caps, 'slow');
    expect(fast).toHaveLength(2);
    expect(slow).toHaveLength(1);
    expect(slow[0]!.name).toBe('video.compress');
  });
});

describe('groupByDomain', () => {
  it('应按领域分组', () => {
    const groups = groupByDomain(caps);
    expect(groups.size).toBe(3);
    expect(groups.get('image')).toHaveLength(2);
    expect(groups.get('pdf')).toHaveLength(1);
    expect(groups.get('video')).toHaveLength(1);
  });

  it('空数组应返回空 Map', () => {
    expect(groupByDomain([]).size).toBe(0);
  });
});

describe('findCapability', () => {
  it('应按名称查找能力', () => {
    const cap = findCapability(caps, 'image.resize');
    expect(cap).toBe(IMAGE_RESIZE);
  });

  it('未找到应返回 undefined', () => {
    expect(findCapability(caps, 'image.nonexistent')).toBeUndefined();
  });
});

describe('isBatchable', () => {
  it('batchable=true 应返回 true', () => {
    expect(isBatchable(IMAGE_RESIZE)).toBe(true);
  });

  it('batchable=false 应返回 false', () => {
    expect(isBatchable(PDF_MERGE)).toBe(false);
  });

  it('未设置 batchable 应返回 false', () => {
    const cap: Capability = { ...IMAGE_RESIZE, batchable: undefined };
    expect(isBatchable(cap)).toBe(false);
  });
});

describe('requiredParams / optionalParams', () => {
  it('requiredParams 应返回必填参数', () => {
    const req = requiredParams(IMAGE_CROP);
    expect(req).toHaveLength(4);
    expect(req.map((p) => p.name).sort()).toEqual([
      'height',
      'width',
      'x',
      'y',
    ]);
  });

  it('optionalParams 应返回可选参数', () => {
    const opt = optionalParams(IMAGE_RESIZE);
    expect(opt.every((p) => !p.required)).toBe(true);
  });

  it('无参数能力应返回空数组', () => {
    expect(requiredParams(PDF_MERGE)).toEqual([]);
    expect(optionalParams(PDF_MERGE)).toEqual([]);
  });
});

describe('defaultParams', () => {
  it('应返回带默认值的参数对象', () => {
    const defaults = defaultParams(IMAGE_RESIZE);
    expect(defaults.fit).toBe('cover');
    expect(defaults.maintainAspectRatio).toBe(true);
  });

  it('无默认值的参数不应出现', () => {
    const defaults = defaultParams(IMAGE_CROP);
    expect(defaults).toEqual({});
  });
});

describe('mergeParams', () => {
  it('用户参数应覆盖默认参数', () => {
    const merged = mergeParams(IMAGE_RESIZE, { width: 800, fit: 'contain' });
    expect(merged.width).toBe(800);
    expect(merged.fit).toBe('contain');
    // 未提供的默认值应保留
    expect(merged.maintainAspectRatio).toBe(true);
  });

  it('空用户参数应返回纯默认参数', () => {
    const merged = mergeParams(IMAGE_RESIZE, {});
    expect(merged.fit).toBe('cover');
  });
});

describe('validateParams', () => {
  it('所有必填参数齐全应返回空数组', () => {
    const missing = validateParams(IMAGE_CROP, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(missing).toEqual([]);
  });

  it('缺少必填参数应返回缺失参数名', () => {
    const missing = validateParams(IMAGE_CROP, { x: 0 });
    expect(missing).toHaveLength(3);
    expect(missing).toContain('y');
    expect(missing).toContain('width');
    expect(missing).toContain('height');
  });

  it('null 值应视为缺失', () => {
    const missing = validateParams(IMAGE_CROP, {
      x: 0,
      y: 0,
      width: null,
      height: 100,
    });
    expect(missing).toEqual(['width']);
  });

  it('无必填参数的能力应总是返回空数组', () => {
    expect(validateParams(PDF_MERGE, {})).toEqual([]);
  });
});

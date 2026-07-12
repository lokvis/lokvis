/**
 * 内置能力预设单元测试
 *
 * 校验所有预设能力声明的结构完整性与一致性。
 */
import { describe, it, expect } from 'vitest';
import {
  IMAGE_CAPABILITIES,
  PDF_CAPABILITIES,
  VIDEO_CAPABILITIES,
  AUDIO_CAPABILITIES,
  ASSET_CAPABILITIES,
  DEVELOPER_CAPABILITIES,
  BUILTIN_CAPABILITIES,
  IMAGE_RESIZE,
  IMAGE_COMPRESS,
  IMAGE_CONVERT,
  IMAGE_CROP,
  IMAGE_ROTATE,
  IMAGE_FLIP,
  PDF_MERGE,
  PDF_SPLIT,
  PDF_ADD_PAGE_NUMBERS,
  VIDEO_COMPRESS,
  VIDEO_TRIM,
  VIDEO_RESIZE,
  VIDEO_CROP,
  VIDEO_NORMALIZE_AUDIO,
  AUDIO_TRIM,
  AUDIO_NORMALIZE,
  AUDIO_DENOISE,
  AUDIO_TRANSCODE,
  AUDIO_MERGE,
} from '../presets/index.js';
import { domainOf } from '../names.js';

describe('图像能力预设', () => {
  it('IMAGE_RESIZE 应有正确的名称与默认值', () => {
    expect(IMAGE_RESIZE.name).toBe('image.resize');
    expect(IMAGE_RESIZE.inputTypes).toEqual(['image']);
    expect(IMAGE_RESIZE.outputTypes).toEqual(['image']);
    expect(IMAGE_RESIZE.performance).toBe('fast');
    expect(IMAGE_RESIZE.batchable).toBe(true);
    const fitParam = IMAGE_RESIZE.params.find((p) => p.name === 'fit');
    expect(fitParam?.default).toBe('cover');
  });

  it('IMAGE_COMPRESS 默认格式应为 webp', () => {
    const formatParam = IMAGE_COMPRESS.params.find((p) => p.name === 'format');
    expect(formatParam?.default).toBe('webp');
    const qualityParam = IMAGE_COMPRESS.params.find((p) => p.name === 'quality');
    expect(qualityParam?.default).toBe(85);
  });

  it('IMAGE_CONVERT 的 format 参数应为必填', () => {
    const formatParam = IMAGE_CONVERT.params.find((p) => p.name === 'format');
    expect(formatParam?.required).toBe(true);
  });

  it('IMAGE_CROP 所有参数都应为必填', () => {
    expect(IMAGE_CROP.params.every((p) => p.required)).toBe(true);
    expect(IMAGE_CROP.params.map((p) => p.name).sort()).toEqual([
      'height',
      'width',
      'x',
      'y',
    ]);
  });

  it('IMAGE_ROTATE 的 angle 参数应为必填', () => {
    const angleParam = IMAGE_ROTATE.params.find((p) => p.name === 'angle');
    expect(angleParam?.required).toBe(true);
  });

  it('IMAGE_FLIP 的 axis 参数应支持三种值', () => {
    const axisParam = IMAGE_FLIP.params.find((p) => p.name === 'axis');
    expect(axisParam?.values).toEqual(['horizontal', 'vertical', 'both']);
  });

  it('IMAGE_CAPABILITIES 应包含全部 9 个图像能力', () => {
    expect(IMAGE_CAPABILITIES).toHaveLength(9);
    const names = IMAGE_CAPABILITIES.map((c) => c.name);
    expect(names).toContain('image.resize');
    expect(names).toContain('image.background');
    expect(names).toContain('image.filter');
  });
});

describe('PDF 能力预设', () => {
  it('PDF_MERGE 应不可批量（一次只能合并）', () => {
    expect(PDF_MERGE.batchable).toBe(false);
    expect(PDF_MERGE.params).toEqual([]);
  });

  it('PDF_SPLIT 应输出 data 类型', () => {
    expect(PDF_SPLIT.outputTypes).toEqual(['data']);
  });

  it('PDF_CAPABILITIES 应包含 8 个能力', () => {
    expect(PDF_CAPABILITIES).toHaveLength(8);
  });

  it('PDF_ADD_PAGE_NUMBERS 应声明页码位置/格式/起始页参数', () => {
    expect(PDF_ADD_PAGE_NUMBERS.name).toBe('pdf.add-page-numbers');
    expect(PDF_ADD_PAGE_NUMBERS.inputTypes).toEqual(['pdf']);
    expect(PDF_ADD_PAGE_NUMBERS.outputTypes).toEqual(['pdf']);
    expect(PDF_ADD_PAGE_NUMBERS.performance).toBe('fast');
    expect(PDF_ADD_PAGE_NUMBERS.batchable).toBe(false);
    const position = PDF_ADD_PAGE_NUMBERS.params.find((p) => p.name === 'position');
    expect(position?.type).toBe('enum');
    expect(position?.values).toEqual(
      expect.arrayContaining(['bottom-center', 'bottom-right', 'top-center', 'top-right'])
    );
    const format = PDF_ADD_PAGE_NUMBERS.params.find((p) => p.name === 'format');
    expect(format?.type).toBe('string');
    const startFrom = PDF_ADD_PAGE_NUMBERS.params.find((p) => p.name === 'startFrom');
    expect(startFrom?.type).toBe('number');
    expect(startFrom?.default).toBe(1);
  });
});

describe('视频能力预设', () => {
  it('VIDEO_COMPRESS 性能应为 slow', () => {
    expect(VIDEO_COMPRESS.performance).toBe('slow');
  });

  it('VIDEO_TRIM 的 start/end 参数应为必填', () => {
    const start = VIDEO_TRIM.params.find((p) => p.name === 'start');
    const end = VIDEO_TRIM.params.find((p) => p.name === 'end');
    expect(start?.required).toBe(true);
    expect(end?.required).toBe(true);
  });

  it('VIDEO_CAPABILITIES 应包含 10 个能力', () => {
    expect(VIDEO_CAPABILITIES).toHaveLength(10);
  });

  it('VIDEO_RESIZE 应声明尺寸/比例保持/适配策略参数', () => {
    expect(VIDEO_RESIZE.name).toBe('video.resize');
    expect(VIDEO_RESIZE.inputTypes).toEqual(['video']);
    expect(VIDEO_RESIZE.outputTypes).toEqual(['video']);
    expect(VIDEO_RESIZE.performance).toBe('medium');
    expect(VIDEO_RESIZE.batchable).toBe(true);
    const fit = VIDEO_RESIZE.params.find((p) => p.name === 'fit');
    expect(fit?.type).toBe('enum');
    expect(fit?.values).toEqual(
      expect.arrayContaining(['cover', 'contain', 'fill', 'inside', 'outside'])
    );
    const maintain = VIDEO_RESIZE.params.find((p) => p.name === 'maintainAspectRatio');
    expect(maintain?.type).toBe('boolean');
    expect(maintain?.default).toBe(true);
  });

  it('VIDEO_CROP 的 x/y/width/height 应为必填', () => {
    expect(VIDEO_CROP.name).toBe('video.crop');
    expect(VIDEO_CROP.inputTypes).toEqual(['video']);
    expect(VIDEO_CROP.outputTypes).toEqual(['video']);
    for (const pname of ['x', 'y', 'width', 'height']) {
      const p = VIDEO_CROP.params.find((pp) => pp.name === pname);
      expect(p?.required).toBe(true);
    }
  });

  it('VIDEO_NORMALIZE_AUDIO 应输出 video 类型且性能为 slow', () => {
    expect(VIDEO_NORMALIZE_AUDIO.name).toBe('video.normalize-audio');
    expect(VIDEO_NORMALIZE_AUDIO.inputTypes).toEqual(['video']);
    expect(VIDEO_NORMALIZE_AUDIO.outputTypes).toEqual(['video']);
    expect(VIDEO_NORMALIZE_AUDIO.performance).toBe('slow');
    const targetLUFS = VIDEO_NORMALIZE_AUDIO.params.find((p) => p.name === 'targetLUFS');
    expect(targetLUFS?.type).toBe('number');
    expect(targetLUFS?.default).toBe(-23);
  });
});

describe('音频能力预设', () => {
  it('AUDIO_TRIM 应有正确的输入输出类型与必填参数', () => {
    expect(AUDIO_TRIM.name).toBe('audio.trim');
    expect(AUDIO_TRIM.inputTypes).toEqual(['audio']);
    expect(AUDIO_TRIM.outputTypes).toEqual(['audio']);
    expect(AUDIO_TRIM.batchable).toBe(true);
    const start = AUDIO_TRIM.params.find((p) => p.name === 'start');
    const end = AUDIO_TRIM.params.find((p) => p.name === 'end');
    expect(start?.required).toBe(true);
    expect(end?.required).toBe(true);
  });

  it('AUDIO_NORMALIZE 应输出 audio 类型', () => {
    expect(AUDIO_NORMALIZE.name).toBe('audio.normalize');
    expect(AUDIO_NORMALIZE.outputTypes).toEqual(['audio']);
    expect(AUDIO_NORMALIZE.performance).toBe('medium');
  });

  it('AUDIO_DENOISE 性能应为 slow', () => {
    expect(AUDIO_DENOISE.name).toBe('audio.denoise');
    expect(AUDIO_DENOISE.performance).toBe('slow');
  });

  it('AUDIO_TRANSCODE 的 format 参数应为必填 enum', () => {
    const format = AUDIO_TRANSCODE.params.find((p) => p.name === 'format');
    expect(format?.type).toBe('enum');
    expect(format?.required).toBe(true);
    expect(format?.values).toContain('mp3');
    expect(format?.values).toContain('wav');
  });

  it('AUDIO_MERGE 应不可批量(一次合并多段)', () => {
    expect(AUDIO_MERGE.name).toBe('audio.merge');
    expect(AUDIO_MERGE.batchable).toBe(false);
  });

  it('AUDIO_CAPABILITIES 应包含 5 个能力且全部 audio 域', () => {
    expect(AUDIO_CAPABILITIES).toHaveLength(5);
    expect(AUDIO_CAPABILITIES.every((c) => domainOf(c.name) === 'audio')).toBe(true);
    const names = AUDIO_CAPABILITIES.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'audio.trim',
        'audio.normalize',
        'audio.denoise',
        'audio.transcode',
        'audio.merge',
      ])
    );
  });
});

describe('内置能力集合', () => {
  it('ASSET_CAPABILITIES 应包含 rename 与 archive', () => {
    const names = ASSET_CAPABILITIES.map((c) => c.name);
    expect(names).toContain('asset.rename');
    expect(names).toContain('asset.archive');
  });

  it('DEVELOPER_CAPABILITIES 应包含 4 个开发工具', () => {
    expect(DEVELOPER_CAPABILITIES).toHaveLength(4);
    expect(DEVELOPER_CAPABILITIES.every((c) => c.name.startsWith('developer.'))).toBe(true);
  });

  it('BUILTIN_CAPABILITIES 应等于各分组合并', () => {
    expect(BUILTIN_CAPABILITIES).toHaveLength(
      IMAGE_CAPABILITIES.length +
        PDF_CAPABILITIES.length +
        VIDEO_CAPABILITIES.length +
        AUDIO_CAPABILITIES.length +
        ASSET_CAPABILITIES.length +
        DEVELOPER_CAPABILITIES.length
    );
  });

  it('所有内置能力名应与领域一致', () => {
    for (const cap of BUILTIN_CAPABILITIES) {
      expect(domainOf(cap.name)).toBeTruthy();
    }
  });

  it('所有内置能力的 name 应唯一', () => {
    const names = BUILTIN_CAPABILITIES.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('所有内置能力应有 description', () => {
    for (const cap of BUILTIN_CAPABILITIES) {
      expect(cap.description.length).toBeGreaterThan(0);
    }
  });

  it('所有内置能力应有合法的 performance 等级', () => {
    const valid = ['fast', 'medium', 'slow'];
    for (const cap of BUILTIN_CAPABILITIES) {
      expect(valid).toContain(cap.performance);
    }
  });

  it('所有 enum 参数应有非空 values', () => {
    for (const cap of BUILTIN_CAPABILITIES) {
      for (const param of cap.params) {
        if (param.type === 'enum') {
          expect(param.values).toBeDefined();
          expect(param.values!.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

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
  AI_CAPABILITIES,
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
  VIDEO_COMPRESS,
  VIDEO_TRIM,
  AUDIO_TRIM,
  AUDIO_TRANSCODE,
  AI_OCR,
  AI_GENERATE_WORKFLOW,
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

  it('VIDEO_CAPABILITIES 应包含 7 个能力', () => {
    expect(VIDEO_CAPABILITIES).toHaveLength(7);
  });
});

describe('音频能力预设', () => {
  it('AUDIO_TRIM 的 start/end 参数应为必填', () => {
    const start = AUDIO_TRIM.params.find((p) => p.name === 'start');
    const end = AUDIO_TRIM.params.find((p) => p.name === 'end');
    expect(start?.required).toBe(true);
    expect(end?.required).toBe(true);
  });

  it('AUDIO_TRANSCODE 的 format 参数应为必填 enum', () => {
    const format = AUDIO_TRANSCODE.params.find((p) => p.name === 'format');
    expect(format?.required).toBe(true);
    expect(format?.type).toBe('enum');
    expect(format?.values?.length).toBeGreaterThan(0);
  });

  it('AUDIO_CAPABILITIES 应包含 5 个能力', () => {
    expect(AUDIO_CAPABILITIES).toHaveLength(5);
  });
});

describe('AI 能力预设', () => {
  it('AI_OCR 应接受 image 与 pdf 输入,输出 text', () => {
    expect(AI_OCR.inputTypes).toEqual(['image', 'pdf']);
    expect(AI_OCR.outputTypes).toEqual(['text']);
  });

  it('AI_GENERATE_WORKFLOW 的 inputTypes 应为空(不接受 Asset 输入)', () => {
    expect(AI_GENERATE_WORKFLOW.inputTypes).toEqual([]);
    expect(AI_GENERATE_WORKFLOW.outputTypes).toEqual(['data']);
    const prompt = AI_GENERATE_WORKFLOW.params.find((p) => p.name === 'prompt');
    expect(prompt?.required).toBe(true);
  });

  it('AI_CAPABILITIES 应包含 5 个能力', () => {
    expect(AI_CAPABILITIES).toHaveLength(5);
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
        AI_CAPABILITIES.length +
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

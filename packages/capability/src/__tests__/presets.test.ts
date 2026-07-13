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
  IMAGE_WATERMARK,
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
  AI_GENERATE_WORKFLOW,
  AI_OPTIMIZE_WORKFLOW,
  AI_CAPTION,
  AI_OCR,
  AI_BACKGROUND_REMOVE,
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

  it('IMAGE_CONVERT 的 format 枚举应包含 ico(用于 favicon 场景)', () => {
    const formatParam = IMAGE_CONVERT.params.find((p) => p.name === 'format');
    expect(formatParam?.values).toContain('ico');
    expect(formatParam?.values).toEqual(
      expect.arrayContaining(['png', 'jpeg', 'webp', 'avif', 'gif', 'ico'])
    );
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

  it('IMAGE_WATERMARK 应声明 imagePath 参数(图片水印)', () => {
    const imagePathParam = IMAGE_WATERMARK.params.find((p) => p.name === 'imagePath');
    expect(imagePathParam?.type).toBe('file');
    expect(imagePathParam?.required).toBe(false);
    // 仍保留 text 参数用于文字水印
    const textParam = IMAGE_WATERMARK.params.find((p) => p.name === 'text');
    expect(textParam?.type).toBe('string');
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

describe('AI 能力预设', () => {
  it('AI_CAPABILITIES 应包含 5 个能力且全部 ai 域', () => {
    expect(AI_CAPABILITIES).toHaveLength(5);
    expect(AI_CAPABILITIES.every((c) => domainOf(c.name) === 'ai')).toBe(true);
    const names = AI_CAPABILITIES.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'ai.generate-workflow',
        'ai.optimize-workflow',
        'ai.caption',
        'ai.ocr',
        'ai.background-remove',
      ])
    );
  });

  it('AI_GENERATE_WORKFLOW 不接受 Asset 输入,声明 prompt 必填参数并输出 data', () => {
    expect(AI_GENERATE_WORKFLOW.name).toBe('ai.generate-workflow');
    expect(AI_GENERATE_WORKFLOW.inputTypes).toEqual([]);
    expect(AI_GENERATE_WORKFLOW.outputTypes).toContain('data');
    expect(AI_GENERATE_WORKFLOW.performance).toBe('slow');
    const prompt = AI_GENERATE_WORKFLOW.params.find((p) => p.name === 'prompt');
    expect(prompt?.type).toBe('string');
    expect(prompt?.required).toBe(true);
  });

  it('AI_OPTIMIZE_WORKFLOW 应接收 data 输入并声明 workflow 必填参数', () => {
    expect(AI_OPTIMIZE_WORKFLOW.name).toBe('ai.optimize-workflow');
    expect(AI_OPTIMIZE_WORKFLOW.inputTypes).toContain('data');
    expect(AI_OPTIMIZE_WORKFLOW.outputTypes).toContain('data');
    const workflow = AI_OPTIMIZE_WORKFLOW.params.find((p) => p.name === 'workflow');
    expect(workflow?.type).toBe('object');
    expect(workflow?.required).toBe(true);
  });

  it('AI_CAPTION 应接收 image 输入并输出 text', () => {
    expect(AI_CAPTION.name).toBe('ai.caption');
    expect(AI_CAPTION.inputTypes).toContain('image');
    expect(AI_CAPTION.outputTypes).toContain('text');
    expect(AI_CAPTION.performance).toBe('slow');
    const language = AI_CAPTION.params.find((p) => p.name === 'language');
    expect(language?.type).toBe('string');
  });

  it('AI_OCR 应接收 image 与 pdf 输入并输出 text', () => {
    expect(AI_OCR.name).toBe('ai.ocr');
    expect(AI_OCR.inputTypes).toEqual(expect.arrayContaining(['image', 'pdf']));
    expect(AI_OCR.outputTypes).toContain('text');
    const format = AI_OCR.params.find((p) => p.name === 'format');
    expect(format?.type).toBe('enum');
    expect(format?.values).toEqual(expect.arrayContaining(['text', 'json', 'structured']));
  });

  it('AI_BACKGROUND_REMOVE 应接收 image 输入并输出 image(背景移除)', () => {
    expect(AI_BACKGROUND_REMOVE.name).toBe('ai.background-remove');
    expect(AI_BACKGROUND_REMOVE.inputTypes).toEqual(['image']);
    expect(AI_BACKGROUND_REMOVE.outputTypes).toEqual(['image']);
    expect(AI_BACKGROUND_REMOVE.performance).toBe('slow');
    const format = AI_BACKGROUND_REMOVE.params.find((p) => p.name === 'format');
    expect(format?.type).toBe('enum');
    expect(format?.values).toEqual(expect.arrayContaining(['png', 'webp']));
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

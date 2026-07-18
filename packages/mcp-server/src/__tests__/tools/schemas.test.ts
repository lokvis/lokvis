/**
 * O-15:zod schema 运行时校验测试
 *
 * 验证:
 * - 合法参数通过校验,data 字段携带解析后的值
 * - 类型不匹配(如 width: "100" 字符串)被拦截,返回 MCP error result
 * - 缺少必填字段被拦截
 * - 枚举非法值被拦截
 * - error 文本包含路径与提示,便于 AI 客户端诊断
 */
import { describe, it, expect } from 'vitest';
import { IMAGE_WATERMARK } from '@lokvis/capability';
import {
  resizeSchema,
  compressSchema,
  convertSchema,
  cropSchema,
  watermarkSchema,
  pdfMergeSchema,
  pdfCompressSchema,
  validateParams,
  WATERMARK_POSITION_VALUES,
} from '../../tools/schemas.js';

describe('O-15:zod schema 运行时校验', () => {
  describe('validateParams 通用行为', () => {
    it('合法参数应返回 { success: true, data }', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        width: 100,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.input_path).toBe('/a.png');
        expect(r.data.width).toBe(100);
      }
    });

    it('未知字段应被 zod 默认 strip(不报错)', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        unknown_field: 'whatever',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect((r.data as Record<string, unknown>).unknown_field).toBeUndefined();
      }
    });

    it('校验失败应返回 { success: false, error } 且 error.isError === true', () => {
      const r = validateParams(resizeSchema, { width: 100 }); // 缺 input_path
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.isError).toBe(true);
        expect(r.error.content).toHaveLength(1);
        expect(r.error.content[0]!.type).toBe('text');
        const text = (r.error.content[0] as { text: string }).text;
        expect(text).toContain('input_path');
      }
    });
  });

  describe('image schemas', () => {
    it('resizeSchema: width 为字符串应被拦截', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        width: '100',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect((r.error.content[0] as { text: string }).text).toContain('width');
      }
    });

    it('resizeSchema: fit 非法枚举应被拦截', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        fit: 'invalid',
      });
      expect(r.success).toBe(false);
    });

    it('compressSchema: 合法 quality 通过', () => {
      const r = validateParams(compressSchema, {
        input_path: '/a.png',
        quality: 80,
      });
      expect(r.success).toBe(true);
    });

    it('convertSchema: format 缺失应被拦截', () => {
      const r = validateParams(convertSchema, { input_path: '/a.png' });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect((r.error.content[0] as { text: string }).text).toContain('format');
      }
    });

    it('convertSchema: format 非法枚举应被拦截', () => {
      const r = validateParams(convertSchema, {
        input_path: '/a.png',
        format: 'bmp',
      });
      expect(r.success).toBe(false);
    });

    it('cropSchema: x/y/width/height 必须为 number', () => {
      const r = validateParams(cropSchema, {
        input_path: '/a.png',
        x: '10',
        y: 10,
        width: 100,
        height: 50,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect((r.error.content[0] as { text: string }).text).toContain('x');
      }
    });

    it('cropSchema: 合法参数通过', () => {
      const r = validateParams(cropSchema, {
        input_path: '/a.png',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });
      expect(r.success).toBe(true);
    });

    it('watermarkSchema: position 非法枚举应被拦截', () => {
      const r = validateParams(watermarkSchema, {
        input_path: '/a.png',
        position: 'middle',
      });
      expect(r.success).toBe(false);
    });

    it('watermarkSchema: position="tile" 合法', () => {
      const r = validateParams(watermarkSchema, {
        input_path: '/a.png',
        position: 'tile',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('pdf schemas', () => {
    it('pdfMergeSchema: input_paths 非数组应被拦截', () => {
      const r = validateParams(pdfMergeSchema, {
        input_paths: '/a.pdf',
      });
      expect(r.success).toBe(false);
    });

    it('pdfMergeSchema: input_paths 数组含非字符串应被拦截', () => {
      const r = validateParams(pdfMergeSchema, {
        input_paths: ['/a.pdf', 123],
      });
      expect(r.success).toBe(false);
    });

    it('pdfMergeSchema: 合法 string[] 通过', () => {
      const r = validateParams(pdfMergeSchema, {
        input_paths: ['/a.pdf', '/b.pdf'],
      });
      expect(r.success).toBe(true);
    });

    it('pdfCompressSchema: level 为字符串应被拦截', () => {
      const r = validateParams(pdfCompressSchema, {
        input_path: '/a.pdf',
        level: '6',
      });
      expect(r.success).toBe(false);
    });

    it('pdfCompressSchema: 合法参数通过', () => {
      const r = validateParams(pdfCompressSchema, {
        input_path: '/a.pdf',
        level: 6,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('与 manifest 一致性', () => {
    it('WATERMARK_POSITION_VALUES 与 IMAGE_WATERMARK.params.position.values 完全一致', () => {
      const positionParam = IMAGE_WATERMARK.params.find(
        (p) => p.name === 'position'
      );
      expect(positionParam).toBeDefined();
      expect(positionParam?.type).toBe('enum');

      const manifestValues: string[] = (positionParam?.values ?? [])
        .slice()
        .sort();
      const schemaValues: string[] = [...WATERMARK_POSITION_VALUES].sort();
      expect(schemaValues).toEqual(manifestValues);
    });
  });
});

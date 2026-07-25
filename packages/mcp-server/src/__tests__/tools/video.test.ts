/**
 * Video tools 单元测试
 *
 * video engine 尚未实装(stub),因此测试仅验证:
 * - getVideoToolRegistrations 返回 7 个 tool 注册
 * - tool 命名遵循 lokvis_video_<verb> 约定
 * - 每个注册有完整的 name/description/inputSchema/handler
 * - schema 校验拒绝非法参数
 * - handler 调用不存在的文件返回错误(不抛异常)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';
import { getVideoToolRegistrations } from '../../tools/video.js';
import {
  videoCompressSchema,
  videoTranscodeSchema,
  videoTrimSchema,
  videoMergeSchema,
  videoToGifSchema,
  videoScreenshotSchema,
  videoExtractAudioSchema,
  validateParams,
} from '../../tools/schemas.js';

describe('Video tools', () => {
  let runtime: LokvisRuntime;

  beforeEach(async () => {
    runtime = await createLokvis({ enableOpfs: false, enableIndexedDB: false });
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.dispose?.();
    }
  });

  describe('getVideoToolRegistrations', () => {
    it('应返回 7 个 tool 注册', () => {
      const regs = getVideoToolRegistrations(runtime);
      expect(regs).toHaveLength(7);
    });

    it('tool 命名应遵循 lokvis_video_<verb> 约定', () => {
      const regs = getVideoToolRegistrations(runtime);
      const names = regs.map((r) => r.name);
      expect(names).toContain('lokvis_video_compress');
      expect(names).toContain('lokvis_video_transcode');
      expect(names).toContain('lokvis_video_trim');
      expect(names).toContain('lokvis_video_merge');
      expect(names).toContain('lokvis_video_to_gif');
      expect(names).toContain('lokvis_video_screenshot');
      expect(names).toContain('lokvis_video_extract_audio');
    });

    it('每个注册应有 name/description/inputSchema/handler', () => {
      const regs = getVideoToolRegistrations(runtime);
      for (const reg of regs) {
        expect(typeof reg.name).toBe('string');
        expect(reg.name.startsWith('lokvis_video_')).toBe(true);
        expect(typeof reg.description).toBe('string');
        expect(reg.description.length).toBeGreaterThan(0);
        expect(typeof reg.inputSchema).toBe('object');
        expect(typeof reg.handler).toBe('function');
      }
    });

    it('每个 inputSchema 应有 type=object 和 properties', () => {
      const regs = getVideoToolRegistrations(runtime);
      for (const reg of regs) {
        const schema = reg.inputSchema as { type: string; properties: object };
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
      }
    });

    it('handler 调用不存在的文件应返回错误(不抛异常)', async () => {
      const regs = getVideoToolRegistrations(runtime);
      const compressReg = regs.find((r) => r.name === 'lokvis_video_compress')!;
      const result = await compressReg.handler({ input_path: '/nonexistent/video.mp4' });
      expect(result).toHaveProperty('content');
      expect(result.isError).toBe(true);
    });
  });

  describe('video schema 校验', () => {
    it('videoCompressSchema: 合法参数通过', () => {
      const r = validateParams(videoCompressSchema, {
        input_path: '/a.mp4',
        quality: 80,
      });
      expect(r.success).toBe(true);
    });

    it('videoCompressSchema: quality 为字符串应被拦截', () => {
      const r = validateParams(videoCompressSchema, {
        input_path: '/a.mp4',
        quality: '80',
      });
      expect(r.success).toBe(false);
    });

    it('videoTranscodeSchema: format 缺失应被拦截', () => {
      const r = validateParams(videoTranscodeSchema, { input_path: '/a.mp4' });
      expect(r.success).toBe(false);
    });

    it('videoTranscodeSchema: format 非法枚举应被拦截', () => {
      const r = validateParams(videoTranscodeSchema, {
        input_path: '/a.mp4',
        format: 'avi',
      });
      expect(r.success).toBe(false);
    });

    it('videoTranscodeSchema: 合法参数通过', () => {
      const r = validateParams(videoTranscodeSchema, {
        input_path: '/a.mp4',
        format: 'webm',
      });
      expect(r.success).toBe(true);
    });

    it('videoTrimSchema: start/end 必填', () => {
      const r = validateParams(videoTrimSchema, { input_path: '/a.mp4' });
      expect(r.success).toBe(false);
    });

    it('videoTrimSchema: 合法参数通过', () => {
      const r = validateParams(videoTrimSchema, {
        input_path: '/a.mp4',
        start: 0,
        end: 10,
      });
      expect(r.success).toBe(true);
    });

    it('videoMergeSchema: input_paths 非数组应被拦截', () => {
      const r = validateParams(videoMergeSchema, { input_paths: '/a.mp4' });
      expect(r.success).toBe(false);
    });

    it('videoMergeSchema: 合法参数通过', () => {
      const r = validateParams(videoMergeSchema, {
        input_paths: ['/a.mp4', '/b.mp4'],
      });
      expect(r.success).toBe(true);
    });

    it('videoToGifSchema: 合法参数通过', () => {
      const r = validateParams(videoToGifSchema, {
        input_path: '/a.mp4',
        fps: 15,
        width: 320,
      });
      expect(r.success).toBe(true);
    });

    it('videoScreenshotSchema: 合法参数通过', () => {
      const r = validateParams(videoScreenshotSchema, {
        input_path: '/a.mp4',
        time: 5,
      });
      expect(r.success).toBe(true);
    });

    it('videoExtractAudioSchema: format 非法枚举应被拦截', () => {
      const r = validateParams(videoExtractAudioSchema, {
        input_path: '/a.mp4',
        format: 'flac',
      });
      expect(r.success).toBe(false);
    });

    it('videoExtractAudioSchema: 合法参数通过', () => {
      const r = validateParams(videoExtractAudioSchema, {
        input_path: '/a.mp4',
        format: 'wav',
      });
      expect(r.success).toBe(true);
    });
  });
});

/**
 * Audio tools 单元测试
 *
 * audio engine 尚未实装(stub),因此测试仅验证:
 * - getAudioToolRegistrations 返回 4 个 tool 注册
 * - tool 命名遵循 lokvis_audio_<verb> 约定
 * - 每个注册有完整的 name/description/inputSchema/handler
 * - schema 校验拒绝非法参数
 * - handler 调用不存在的文件返回错误(不抛异常)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';
import { getAudioToolRegistrations } from '../../tools/audio.js';
import {
  audioCompressSchema,
  audioTranscodeSchema,
  audioTrimSchema,
  audioMergeSchema,
  validateParams,
} from '../../tools/schemas.js';

describe('Audio tools', () => {
  let runtime: LokvisRuntime;

  beforeEach(async () => {
    runtime = await createLokvis({ enableOpfs: false, enableIndexedDB: false });
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.dispose?.();
    }
  });

  describe('getAudioToolRegistrations', () => {
    it('应返回 4 个 tool 注册', () => {
      const regs = getAudioToolRegistrations(runtime);
      expect(regs).toHaveLength(4);
    });

    it('tool 命名应遵循 lokvis_audio_<verb> 约定', () => {
      const regs = getAudioToolRegistrations(runtime);
      const names = regs.map((r) => r.name);
      expect(names).toContain('lokvis_audio_compress');
      expect(names).toContain('lokvis_audio_transcode');
      expect(names).toContain('lokvis_audio_trim');
      expect(names).toContain('lokvis_audio_merge');
    });

    it('每个注册应有 name/description/inputSchema/handler', () => {
      const regs = getAudioToolRegistrations(runtime);
      for (const reg of regs) {
        expect(typeof reg.name).toBe('string');
        expect(reg.name.startsWith('lokvis_audio_')).toBe(true);
        expect(typeof reg.description).toBe('string');
        expect(reg.description.length).toBeGreaterThan(0);
        expect(typeof reg.inputSchema).toBe('object');
        expect(typeof reg.handler).toBe('function');
      }
    });

    it('每个 inputSchema 应有 type=object 和 properties', () => {
      const regs = getAudioToolRegistrations(runtime);
      for (const reg of regs) {
        const schema = reg.inputSchema as { type: string; properties: object };
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
      }
    });

    it('handler 调用不存在的文件应返回错误(不抛异常)', async () => {
      const regs = getAudioToolRegistrations(runtime);
      const compressReg = regs.find((r) => r.name === 'lokvis_audio_compress')!;
      const result = await compressReg.handler({ input_path: '/nonexistent/audio.mp3' });
      expect(result).toHaveProperty('content');
      expect(result.isError).toBe(true);
    });
  });

  describe('audio schema 校验', () => {
    it('audioCompressSchema: 合法参数通过', () => {
      const r = validateParams(audioCompressSchema, {
        input_path: '/a.mp3',
        bitrate: 128,
      });
      expect(r.success).toBe(true);
    });

    it('audioCompressSchema: bitrate 为字符串应被拦截', () => {
      const r = validateParams(audioCompressSchema, {
        input_path: '/a.mp3',
        bitrate: '128',
      });
      expect(r.success).toBe(false);
    });

    it('audioTranscodeSchema: format 缺失应被拦截', () => {
      const r = validateParams(audioTranscodeSchema, { input_path: '/a.mp3' });
      expect(r.success).toBe(false);
    });

    it('audioTranscodeSchema: format 非法枚举应被拦截', () => {
      const r = validateParams(audioTranscodeSchema, {
        input_path: '/a.mp3',
        format: 'wma',
      });
      expect(r.success).toBe(false);
    });

    it('audioTranscodeSchema: 合法参数通过', () => {
      const r = validateParams(audioTranscodeSchema, {
        input_path: '/a.mp3',
        format: 'flac',
      });
      expect(r.success).toBe(true);
    });

    it('audioTrimSchema: start/end 必填', () => {
      const r = validateParams(audioTrimSchema, { input_path: '/a.mp3' });
      expect(r.success).toBe(false);
    });

    it('audioTrimSchema: 合法参数通过', () => {
      const r = validateParams(audioTrimSchema, {
        input_path: '/a.mp3',
        start: 0,
        end: 30,
      });
      expect(r.success).toBe(true);
    });

    it('audioMergeSchema: input_paths 非数组应被拦截', () => {
      const r = validateParams(audioMergeSchema, { input_paths: '/a.mp3' });
      expect(r.success).toBe(false);
    });

    it('audioMergeSchema: 合法参数通过', () => {
      const r = validateParams(audioMergeSchema, {
        input_paths: ['/a.mp3', '/b.mp3'],
      });
      expect(r.success).toBe(true);
    });
  });
});

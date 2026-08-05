import { describe, it, expect, vi } from 'vitest';
import {
  getFfmpegPath,
  mimeTypeForFormat,
  validateTrimRange,
} from '../node-ffmpeg.js';

// Mock ffmpeg-static
vi.mock('ffmpeg-static', () => ({
  default: '/mock/ffmpeg/path',
}));

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

describe('node-ffmpeg shared utilities', () => {
  describe('getFfmpegPath', () => {
    it('应返回 ffmpeg-static 的路径', async () => {
      const path = await getFfmpegPath();
      expect(path).toBe('/mock/ffmpeg/path');
    });
  });

  describe('mimeTypeForFormat', () => {
    it('应正确映射视频格式', () => {
      expect(mimeTypeForFormat('mp4')).toBe('video/mp4');
      expect(mimeTypeForFormat('webm')).toBe('video/webm');
      expect(mimeTypeForFormat('gif')).toBe('image/gif');
    });

    it('应正确映射音频格式', () => {
      expect(mimeTypeForFormat('mp3')).toBe('audio/mpeg');
      expect(mimeTypeForFormat('wav')).toBe('audio/wav');
      expect(mimeTypeForFormat('ogg')).toBe('audio/ogg');
      expect(mimeTypeForFormat('aac')).toBe('audio/aac');
      expect(mimeTypeForFormat('flac')).toBe('audio/flac');
    });

    it('应正确映射图片格式', () => {
      expect(mimeTypeForFormat('png')).toBe('image/png');
      expect(mimeTypeForFormat('jpeg')).toBe('image/jpeg');
      expect(mimeTypeForFormat('webp')).toBe('image/webp');
    });

    it('未知格式应返回 octet-stream', () => {
      expect(mimeTypeForFormat('unknown')).toBe('application/octet-stream');
    });
  });

  describe('validateTrimRange', () => {
    it('合法范围不应抛错', () => {
      expect(() => validateTrimRange(0, 10)).not.toThrow();
      expect(() => validateTrimRange(5, 15)).not.toThrow();
    });

    it('start 为负数应抛错', () => {
      expect(() => validateTrimRange(-1, 10)).toThrow('start must be >= 0');
    });

    it('end <= start 应抛错', () => {
      expect(() => validateTrimRange(10, 10)).toThrow('end (10) must be > start (10)');
      expect(() => validateTrimRange(10, 5)).toThrow('end (5) must be > start (10)');
    });

    it('end 超过 duration 应抛错', () => {
      expect(() => validateTrimRange(0, 20, 10)).toThrow('end (20) exceeds duration (10)');
    });

    it('end 未提供时不校验 duration', () => {
      expect(() => validateTrimRange(0, undefined, 10)).not.toThrow();
    });
  });
});

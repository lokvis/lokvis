// @vitest-environment jsdom
/**
 * toolkit/download.ts 纯函数单测(W5 review #16)
 *
 * 覆盖 formatBytes / formatFromMime(间接)/ imageInfoToMeta / getImageInfo。
 * getImageInfo 用 jsdom 的 Image + mock decode 验证。
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  formatBytes,
  getImageInfo,
  imageInfoToMeta,
  type ImageInfo,
} from '@/components/toolkit/download';

describe('formatBytes', () => {
  it('小于 1024 时显示 B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('1024 ~ 1MB 之间显示 KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024 - 1)).toMatch(/KB$/);
  });

  it('大于等于 1MB 显示 MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.50 MB');
  });
});

describe('imageInfoToMeta', () => {
  it('null 时返回空字符串', () => {
    expect(imageInfoToMeta(null)).toBe('');
  });

  it('生成 "宽×高 · 大小 · 格式" 格式', () => {
    const info: ImageInfo = { width: 800, height: 600, size: 1024 * 100, format: 'JPEG' };
    expect(imageInfoToMeta(info)).toBe('800×600 · 100.0 KB · JPEG');
  });

  it('SVG 格式正确显示(无 +xml 后缀,#11)', () => {
    const info: ImageInfo = { width: 0, height: 0, size: 512, format: 'SVG' };
    expect(imageInfoToMeta(info)).toBe('0×0 · 512 B · SVG');
  });
});

describe('getImageInfo', () => {
  // jsdom 缺少 URL.createObjectURL / revokeObjectURL,每个测试前 stub
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** mock Image 构造函数:返回带 naturalWidth/Height + decode 的假对象 */
  function mockImage(naturalWidth: number, naturalHeight: number, decodeOk = true) {
    class FakeImage {
      naturalWidth = naturalWidth;
      naturalHeight = naturalHeight;
      src = '';
      decode() {
        return decodeOk ? Promise.resolve() : Promise.reject(new Error('decode failed'));
      }
    }
    vi.stubGlobal('Image', FakeImage);
  }

  it('从 Blob 读取 width/height/size/format', async () => {
    mockImage(1024, 768);
    const blob = new Blob(['fake'], { type: 'image/png' });
    const info = await getImageInfo(blob);
    expect(info).not.toBeNull();
    if (info) {
      expect(info.width).toBe(1024);
      expect(info.height).toBe(768);
      expect(info.format).toBe('PNG');
      expect(info.size).toBe(blob.size); // 与传入 Blob 的 size 一致
    }
  });

  it('SVG+xml 格式提取为 SVG(#11)', async () => {
    mockImage(0, 0);
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    const info = await getImageInfo(blob);
    expect(info).not.toBeNull();
    if (info) {
      expect(info.format).toBe('SVG');
    }
  });

  it('decode 失败时返回 null', async () => {
    mockImage(0, 0, false);
    const blob = new Blob(['broken'], { type: 'image/png' });
    const info = await getImageInfo(blob);
    expect(info).toBeNull();
  });
});

/**
 * FormatSupportProbe 单元测试。
 *
 * Node 环境无 OffscreenCanvas / document:
 * - png/jpeg 短路为 true
 * - 其余格式一律 false(环境安全,不抛错)
 * - 未知格式 false
 */
import { describe, it, expect } from 'vitest';
import { detectEncodeSupport } from '../format-support.js';

describe('detectEncodeSupport', () => {
  it('png/jpeg 应短路返回 true(无需画布)', async () => {
    const result = await detectEncodeSupport(['png', 'jpeg']);
    expect(result).toEqual({ png: true, jpeg: true });
  });

  it('Node 环境下待测格式应一律返回 false(不抛错)', async () => {
    const result = await detectEncodeSupport(['png', 'webp', 'avif', 'gif']);
    expect(result).toEqual({ png: true, webp: false, avif: false, gif: false });
  });

  it('未知格式应返回 false', async () => {
    const result = await detectEncodeSupport(['bmp', 'tiff']);
    expect(result).toEqual({ bmp: false, tiff: false });
  });

  it('空列表应返回空映射', async () => {
    const result = await detectEncodeSupport([]);
    expect(result).toEqual({});
  });
});

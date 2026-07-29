/**
 * formatBytes 单元测试
 *
 * 覆盖 1024 进制各量级边界与非法输入回退。统一(带空格)格式:
 * B / KB(1 位小数)/ MB(1 位小数)/ GB(2 位小数)。
 */
import { describe, it, expect } from 'vitest';
import { formatBytes } from '../format.js';

describe('formatBytes', () => {
  it('字节级(< 1KB)', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('KB 级', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('MB 级', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatBytes(512 * 1024 * 1024)).toBe('512.0 MB');
  });

  it('GB 级', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
  });

  it('非有限或负数应回退到 0 B', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
    expect(formatBytes(Infinity)).toBe('0 B');
    expect(formatBytes(-Infinity)).toBe('0 B');
  });
});

/**
 * CLI 版本号常量测试
 */
import { describe, it, expect } from 'vitest';
import { version } from '../version.js';

describe('version 常量', () => {
  it('应为非空字符串', () => {
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  it('应符合 semver 格式', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

/**
 * `lokvis capabilities` 命令单元测试
 *
 * 验证 listCapabilities() 返回 BUILTIN_CAPABILITIES 引用(同一份数据,无副本)。
 */
import { describe, it, expect } from 'vitest';
import { listCapabilities } from '../../commands/capabilities.js';
import { BUILTIN_CAPABILITIES } from '@lokvis/capability';

describe('listCapabilities', () => {
  it('应返回 BUILTIN_CAPABILITIES 数组', () => {
    const caps = listCapabilities();
    expect(caps).toBe(BUILTIN_CAPABILITIES);
  });

  it('返回的数组应包含若干内置能力', () => {
    const caps = listCapabilities();
    expect(caps.length).toBeGreaterThan(0);
    // 抽样校验:每个元素都具备 Capability 必填字段
    for (const cap of caps) {
      expect(typeof cap.name).toBe('string');
      expect(typeof cap.description).toBe('string');
      expect(Array.isArray(cap.inputTypes)).toBe(true);
      expect(Array.isArray(cap.outputTypes)).toBe(true);
      expect(Array.isArray(cap.params)).toBe(true);
      expect(['fast', 'medium', 'slow']).toContain(cap.performance);
    }
  });

  it('应包含 image.resize 能力', () => {
    const caps = listCapabilities();
    const names = caps.map((c) => c.name);
    expect(names).toContain('image.resize');
  });
});

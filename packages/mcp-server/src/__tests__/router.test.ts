/**
 * toolToCapability 单元测试(T1/T4)
 *
 * 验证 MCP tool 名 → Lokvis capability 名的反向推断:
 * - 默认 tool 名 `lokvis_<domain>_<verb>` → `<domain>.<verb>`(domain 在前)
 * - 去掉 `lokvis_` 前缀
 * - 单段名原样返回
 * - 多词 verb 用下划线还原(而非点号)
 *
 * 覆盖 B1 修复:此前实现误把 domain 放在末尾且用点号拼接 verb,
 * 导致 `lokvis_image_resize` → `resize.image`(错误)。
 */
import { describe, it, expect } from 'vitest';
import { toolToCapability } from '../router.js';

describe('toolToCapability', () => {
  it('应把默认 tool 名反推为 <domain>.<verb>(domain 在前)', () => {
    // 默认映射:image.resize → lokvis_image_resize(domain 在前)
    expect(toolToCapability('lokvis_image_resize')).toBe('image.resize');
    expect(toolToCapability('lokvis_pdf_merge')).toBe('pdf.merge');
    expect(toolToCapability('lokvis_image_compress')).toBe('image.compress');
  });

  it('应按下划线还原多词 verb(而非点号)', () => {
    // image.batch_process → lokvis_image_batch_process
    // 反推应得回 image.batch_process(用下划线,不是 image.batch.process)
    expect(toolToCapability('lokvis_image_batch_process')).toBe(
      'image.batch_process'
    );
    expect(toolToCapability('lokvis_pdf_split_pages')).toBe('pdf.split_pages');
  });

  it('无 lokvis_ 前缀时应直接按 body 推断', () => {
    expect(toolToCapability('image_resize')).toBe('image.resize');
  });

  it('单段名(无下划线)应原样返回', () => {
    expect(toolToCapability('lokvis_image')).toBe('image');
    expect(toolToCapability('image')).toBe('image');
  });

  it('空前缀 lokvis_ 后无内容时应返回空串', () => {
    expect(toolToCapability('lokvis_')).toBe('');
  });

  it('与 toMcpManifest 默认 tool 名约定互为逆运算', () => {
    // 默认 tool 名 = lokvis_${name.replace(/\./g, '_')}
    const cases = ['image.resize', 'pdf.merge', 'image.batch_process'];
    for (const name of cases) {
      const tool = `lokvis_${name.replace(/\./g, '_')}`;
      expect(toolToCapability(tool)).toBe(name);
    }
  });
});

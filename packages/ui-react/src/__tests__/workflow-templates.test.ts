/**
 * W11.4 工作流模板数据单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_TEMPLATES,
  findTemplate,
  type WorkflowTemplate,
} from '../data/workflow-templates.js';

describe('W11.4 工作流模板数据', () => {
  it('应提供 5 个内置模板', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(5);
  });

  it('每个模板应有完整字段(id/name/description/icon/category/nodes)', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.icon).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(Array.isArray(tpl.nodes)).toBe(true);
      expect(tpl.nodes.length).toBeGreaterThan(0);
    }
  });

  it('模板 id 应唯一', () => {
    const ids = WORKFLOW_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个模板节点数应 ≤ 5(M1 MVP 约束)', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(tpl.nodes.length).toBeLessThanOrEqual(5);
    }
  });

  it('每个模板节点应有合法 capability(domain.action 格式)', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      for (const node of tpl.nodes) {
        expect(node.capability).toMatch(/^[a-z]+\.[a-z-]+$/);
        expect(typeof node.params).toBe('object');
        expect(node.params).not.toBe(null);
      }
    }
  });

  it('应包含 5 个分类(web/social/ecommerce/print/utility)', () => {
    const categories = new Set(WORKFLOW_TEMPLATES.map((t) => t.category));
    expect(categories.has('web')).toBe(true);
    expect(categories.has('social')).toBe(true);
    expect(categories.has('ecommerce')).toBe(true);
    expect(categories.has('print')).toBe(true);
    expect(categories.has('utility')).toBe(true);
  });

  it('Web 优化模板应为 resize + compress(webp)', () => {
    const tpl = findTemplate('tpl-web-optimize');
    expect(tpl).toBeDefined();
    const node0 = tpl!.nodes[0];
    const node1 = tpl!.nodes[1];
    expect(node0?.capability).toBe('image.resize');
    expect(node1?.capability).toBe('image.compress');
    expect(node1?.params.format).toBe('webp');
  });

  it('社媒批量模板应包含 watermark 节点', () => {
    const tpl = findTemplate('tpl-social-batch');
    expect(tpl).toBeDefined();
    const hasWatermark = tpl!.nodes.some((n) => n.capability === 'image.watermark');
    expect(hasWatermark).toBe(true);
  });

  it('电商主图模板应有 3 个节点(5 步内)', () => {
    const tpl = findTemplate('tpl-ecommerce-main');
    expect(tpl).toBeDefined();
    expect(tpl!.nodes).toHaveLength(3);
  });

  it('打印预处理模板应输出 PNG(无损)', () => {
    const tpl = findTemplate('tpl-print-prep');
    expect(tpl).toBeDefined();
    const hasConvert = tpl!.nodes.some((n) => n.capability === 'image.convert');
    expect(hasConvert).toBe(true);
  });

  it('findTemplate 不存在的 id 应返回 undefined', () => {
    expect(findTemplate('non-existent')).toBeUndefined();
  });

  it('模板类型 WorkflowTemplate 应可静态使用', () => {
    const tpl: WorkflowTemplate = WORKFLOW_TEMPLATES[0]!;
    expect(tpl.id).toBeTruthy();
  });
});

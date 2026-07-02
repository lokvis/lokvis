/**
 * @lokvis/schema 校验器单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  validateWorkflow,
  validatePluginManifest,
  SCHEMA_VERSION,
  RUNTIME_MIN_VERSION,
} from '../index.js';

// ─── 测试夹具 ───────────────────────────────────────────────

const validWorkflow = {
  id: 'wf-resize-for-web',
  version: '1.0.0',
  name: 'Resize for Web',
  description: 'Resize and compress images for web usage',
  author: { id: 'user-1', name: 'Alice' },
  category: 'image',
  tags: ['resize', 'compress', 'web'],
  nodes: [
    { id: 'n1', type: 'load', capability: 'asset.import' },
    { id: 'n2', type: 'transform', capability: 'image.resize', params: { width: 800 } },
    { id: 'n3', type: 'export', capability: 'asset.export' },
  ],
  edges: [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
  ],
  inputs: {
    type: 'image',
    multiple: true,
    maxCount: 10,
    accept: ['image/png', 'image/jpeg'],
  },
  outputs: {
    type: 'image',
    format: 'webp',
  },
};

const validManifest = {
  name: 'lokvis-image-tools',
  version: '0.1.0',
  description: 'Official image tools plugin',
  author: 'Lokvis',
  license: 'MIT',
  main: './dist/index.js',
  capabilities: ['image.resize', 'image.compress'],
  engines: { 'lokvis-runtime': '^0.1.0' },
  permissions: ['asset:read', 'asset:write', 'network:none'],
};

// ─── Workflow 校验 ─────────────────────────────────────────

describe('validateWorkflow', () => {
  it('合法工作流应校验通过', () => {
    const result = validateWorkflow(validWorkflow);
    expect(result.success).toBe(true);
  });

  it('缺少必填字段 id 应失败', () => {
    const { id: _id, ...rest } = validWorkflow;
    const result = validateWorkflow(rest);
    expect(result.success).toBe(false);
  });

  it('节点 type 必须为 load/transform/export', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [{ id: 'n1', type: 'invalid', capability: 'asset.import' }],
    });
    expect(result.success).toBe(false);
  });

  it('inputs.type 必须为合法 AssetType', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      inputs: { type: 'executable', multiple: false },
    });
    expect(result.success).toBe(false);
  });

  it('outputs.type 支持 archive', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      outputs: { type: 'archive' },
    });
    expect(result.success).toBe(true);
  });

  it('可选字段缺失时仍应通过', () => {
    const minimal = {
      id: 'wf-min',
      version: '0.1.0',
      name: 'Min',
      description: '',
      author: { id: 'u', name: 'u' },
      category: 'other',
      tags: [],
      nodes: [],
      edges: [],
      inputs: { type: 'data', multiple: false },
      outputs: { type: 'data' },
    };
    const result = validateWorkflow(minimal);
    expect(result.success).toBe(true);
  });

  it('maxCount 必须为正整数', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      inputs: { type: 'image', multiple: true, maxCount: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('author 必须包含 id 与 name', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      author: { id: 'u' },
    });
    expect(result.success).toBe(false);
  });

  // ─── 结构层校验（修复 review：__input__ 哨兵边误判为环） ───

  it('edge.from 引用保留字 __input__ 应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize', params: {} }],
      edges: [{ from: '__input__', to: 'n1' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/__input__.*reserved/i);
    }
  });

  it('edge.from 引用不存在节点应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize', params: {} }],
      edges: [{ from: 'ghost', to: 'n1' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/unknown source node.*ghost/i);
    }
  });

  it('edge.to 引用不存在节点应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize', params: {} }],
      edges: [{ from: 'n1', to: 'void' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/unknown target node.*void/i);
    }
  });

  it('edge 自环应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize', params: {} }],
      edges: [{ from: 'n1', to: 'n1' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/self-loop/i);
    }
  });

  it('重复 node id 应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n1', type: 'transform', capability: 'image.watermark', params: {} },
      ],
      edges: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/duplicate node id.*n1/i);
    }
  });

  it('工作流含环应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n2', type: 'transform', capability: 'image.watermark', params: {} },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n1' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/cycle/i);
    }
  });

  it('多入口 DAG（多入度 0 节点）应通过', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n2', type: 'transform', capability: 'image.watermark', params: {} },
      ],
      edges: [],
    });
    expect(result.success).toBe(true);
  });
});

// ─── Plugin Manifest 校验 ──────────────────────────────────

describe('validatePluginManifest', () => {
  it('合法 manifest 应校验通过', () => {
    const result = validatePluginManifest(validManifest);
    expect(result.success).toBe(true);
  });

  it('缺少 capabilities 字段应失败', () => {
    const { capabilities: _c, ...rest } = validManifest;
    const result = validatePluginManifest(rest);
    expect(result.success).toBe(false);
  });

  it('缺少 engines.lokvis-runtime 应失败', () => {
    const result = validatePluginManifest({
      ...validManifest,
      engines: {},
    });
    expect(result.success).toBe(false);
  });

  it('icon 为可选字段', () => {
    const result = validatePluginManifest({ ...validManifest, icon: '📦' });
    expect(result.success).toBe(true);
  });

  it('permissions 必须为数组', () => {
    const result = validatePluginManifest({
      ...validManifest,
      permissions: 'asset:read',
    });
    expect(result.success).toBe(false);
  });
});

// ─── 版本常量 ──────────────────────────────────────────────

describe('版本常量', () => {
  it('SCHEMA_VERSION 应为 1.0.0', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0');
  });

  it('RUNTIME_MIN_VERSION 应为 0.1.0', () => {
    expect(RUNTIME_MIN_VERSION).toBe('0.1.0');
  });
});

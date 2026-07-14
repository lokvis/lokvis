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

// ─── W10.2: capability 兼容性校验 ──────────────────────────

describe('W10.2 capability 兼容性校验', () => {
  /** 模拟 capability 解析回调 */
  const resolveCap = (name: string) => {
    const map: Record<string, { inputTypes: string[]; outputTypes: string[] }> = {
      'image.resize': { inputTypes: ['image'], outputTypes: ['image'] },
      'image.compress': { inputTypes: ['image'], outputTypes: ['image'] },
      'image.watermark': { inputTypes: ['image'], outputTypes: ['image'] },
      'pdf.to-images': { inputTypes: ['pdf'], outputTypes: ['image'] },
      'video.to-frames': { inputTypes: ['video'], outputTypes: ['image'] },
    };
    return map[name];
  };

  /** 构造 transform-only 线性工作流(2 节点) */
  const linearWf = (cap1: string, cap2: string) => ({
    ...validWorkflow,
    nodes: [
      { id: 'n1', type: 'transform' as const, capability: cap1, params: {} },
      { id: 'n2', type: 'transform' as const, capability: cap2, params: {} },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  });

  it('相邻节点类型兼容应通过(image.resize → image.compress)', () => {
    const result = validateWorkflow(linearWf('image.resize', 'image.compress'), {
      resolveCapability: resolveCap,
    });
    expect(result.success).toBe(true);
  });

  it('相邻节点类型兼容应通过(pdf.to-images → image.resize,inputs.type=pdf)', () => {
    // pdf.to-images 接受 pdf 输出 image;image.resize 接受 image → 兼容
    const result = validateWorkflow({
      ...linearWf('pdf.to-images', 'image.resize'),
      inputs: { type: 'pdf', multiple: false },
    }, {
      resolveCapability: resolveCap,
    });
    expect(result.success).toBe(true);
  });

  it('相邻节点类型不兼容应失败(image.resize → video.to-frames)', () => {
    // image.resize 输出 image,video.to-frames 接受 video → 不兼容
    const result = validateWorkflow(linearWf('image.resize', 'video.to-frames'), {
      resolveCapability: resolveCap,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/Capability mismatch.*image\.resize.*video\.to-frames/);
    }
  });

  it('输入节点 inputTypes 与 workflow.inputs.type 不兼容应失败', () => {
    // workflow.inputs.type = image,但首节点 video.to-frames 接受 video
    const result = validateWorkflow(linearWf('video.to-frames', 'image.resize'), {
      resolveCapability: resolveCap,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/expects input types.*video.*workflow input is "image"/);
    }
  });

  it('输出节点 outputTypes 与 workflow.outputs.type 不兼容应失败', () => {
    // workflow.outputs.type = image,末节点 video.to-frames 输出 image → 兼容
    const result = validateWorkflow({
      ...linearWf('image.resize', 'video.to-frames'),
      outputs: { type: 'video' },
    }, {
      resolveCapability: resolveCap,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/produces output types.*image.*workflow output is "video"/);
    }
  });

  it('archive 输出类型允许任意末节点输出', () => {
    const result = validateWorkflow({
      ...linearWf('image.resize', 'video.to-frames'),
      outputs: { type: 'archive' },
    }, {
      resolveCapability: resolveCap,
    });
    // 但输入仍是 image,首节点 image.resize 接受 image,兼容;末节点 video.to-frames 输出 image
    // 但相邻节点 image.resize → video.to-frames 不兼容(image → video)
    // 所以应该失败在相邻节点检查
    expect(result.success).toBe(false);
  });

  it('未注册的 capability 应在 schema 层显式报错(不静默跳过)', () => {
    const result = validateWorkflow(linearWf('unknown.cap', 'image.resize'), {
      resolveCapability: resolveCap,
    });
    // unknown.cap 未注册:不再静默跳过,schema 层应报错
    // 避免用户得到"校验通过"假象,运行时才报错
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /unknown capability "unknown\.cap"/.test(i.message)))
        .toBe(true);
    }
  });

  it('B4: 未注册 capability 在非输入节点(transform,入度>0)也应报错', () => {
    // 原实现仅检查入度 0 节点,n2(入度 1)的 unknown.cap 在 5b 边检查中被
    // `!fromCap || !toCap` continue 静默跳过。B4 修复后 5a 全节点覆盖。
    const result = validateWorkflow(linearWf('image.resize', 'unknown.cap'), {
      resolveCapability: resolveCap,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /unknown capability "unknown\.cap"/.test(i.message)))
        .toBe(true);
    }
  });

  it('B4 验收: seed #8 audio.denoise 未注册时应失败并报告 unknown capability', () => {
    // 验收标准:seed #8 在 audio preset 未注册时,
    // validateWorkflow(wf, { resolveCapability }) 应返回失败并报告 "unknown capability: audio.denoise"
    const audioDenoiseWf = {
      ...validWorkflow,
      nodes: [
        { id: 'n1', type: 'transform' as const, capability: 'asset.import', params: {} },
        { id: 'n2', type: 'transform' as const, capability: 'audio.denoise', params: { level: 0.5 } },
        { id: 'n3', type: 'transform' as const, capability: 'asset.export', params: {} },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
      inputs: { type: 'audio', multiple: false },
      outputs: { type: 'audio' },
    };
    // resolveCapability 不注册 audio.denoise(模拟 audio preset 未注册)
    const partialResolve = (name: string) => {
      const map: Record<string, { inputTypes: string[]; outputTypes: string[] }> = {
        'asset.import': { inputTypes: ['audio'], outputTypes: ['audio'] },
        'asset.export': { inputTypes: ['audio'], outputTypes: ['audio'] },
      };
      return map[name];
    };
    const result = validateWorkflow(audioDenoiseWf, {
      resolveCapability: partialResolve,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /unknown capability "audio\.denoise"/.test(i.message)))
        .toBe(true);
    }
  });

  it('resolveCapability 未提供时应跳过兼容性校验(向后兼容)', () => {
    const result = validateWorkflow(linearWf('image.resize', 'video.to-frames'));
    expect(result.success).toBe(true);
  });
});

// ─── W10.3: maxSteps 节点数上限校验 ─────────────────────────

describe('W10.3 maxSteps 节点数上限校验', () => {
  it('节点数等于 maxSteps 应通过', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n2', type: 'transform', capability: 'image.compress', params: {} },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
    }, { maxSteps: 2 });
    expect(result.success).toBe(true);
  });

  it('节点数超过 maxSteps 应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n2', type: 'transform', capability: 'image.compress', params: {} },
        { id: 'n3', type: 'transform', capability: 'image.watermark', params: {} },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
    }, { maxSteps: 2 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/3 nodes.*exceeds max 2/i);
    }
  });

  it('maxSteps 未提供时不限制节点数', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i + 1}`,
      type: 'transform' as const,
      capability: 'image.resize',
      params: {},
    }));
    const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: `n${i + 2}` }));
    const result = validateWorkflow({
      ...validWorkflow,
      nodes,
      edges,
    });
    expect(result.success).toBe(true);
  });
});

// ─── W10: 枚举 schema 校验 ─────────────────────────────────

describe('W10 枚举 schema 校验', () => {
  it('category 必须为合法 WorkflowCategory', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      category: 'invalid-category',
    });
    expect(result.success).toBe(false);
  });

  it('category 合法值应通过(image/video/audio/pdf/ai/data/developer/ecommerce/content-creation/other)', () => {
    for (const cat of ['image', 'video', 'audio', 'pdf', 'ai', 'data', 'developer', 'ecommerce', 'content-creation', 'other']) {
      const result = validateWorkflow({ ...validWorkflow, category: cat });
      expect(result.success).toBe(true);
    }
  });

  it('outputs.type 必须为合法枚举(含 archive)', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      outputs: { type: 'invalid-output' },
    });
    expect(result.success).toBe(false);
  });
});

describe('E1 多 target 输出校验', () => {
  it('合法 targets 应通过校验', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      outputs: {
        type: 'image',
        format: 'jpeg',
        targets: [
          { name: 'instagram', params: { width: 1080, height: 1080 } },
          { name: 'twitter', params: { width: 1200, height: 675 } },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('targets 无 params 也应通过', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      outputs: {
        type: 'image',
        targets: [{ name: 'default' }, { name: 'alt' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('重复 target name 应失败', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      outputs: {
        type: 'image',
        targets: [
          { name: 'instagram', params: { width: 1080 } },
          { name: 'instagram', params: { width: 1200 } },
        ],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Duplicate output target name'))).toBe(true);
    }
  });

  it('target 缺少 name 应失败（Zod 形状校验）', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      outputs: {
        type: 'image',
        targets: [{ params: { width: 1080 } } as unknown as { name: string }],
      },
    });
    expect(result.success).toBe(false);
  });

  it('空 targets 数组应通过（等价于无 targets）', () => {
    const result = validateWorkflow({
      ...validWorkflow,
      outputs: { type: 'image', targets: [] },
    });
    expect(result.success).toBe(true);
  });
});

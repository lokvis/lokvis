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

  it('未注册 capability 位于非输入节点(中间/末尾 transform 节点)时也应报错', () => {
    // 首节点 image.resize 已注册(in-degree 0,5a 通过);
    // 末节点 unknown.cap 未注册(in-degree 1,旧 5b 静默跳过 → bug)
    // 修复后应遍历所有带 capability 的节点报错
    const result = validateWorkflow(linearWf('image.resize', 'unknown.cap'), {
      resolveCapability: resolveCap,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /unknown capability "unknown\.cap"/.test(i.message)))
        .toBe(true);
    }
  });

  it('未注册 capability 位于三节点链中间节点时也应报错', () => {
    // n1 image.resize(已知) → n2 audio.denoise(未注册) → n3 image.compress(已知)
    // 旧实现:5b 边检查 !toCap 时 continue 跳过,5a 仅查入度 0 节点 → 漏报
    const result = validateWorkflow({
      ...validWorkflow,
      nodes: [
        { id: 'n1', type: 'transform' as const, capability: 'image.resize', params: {} },
        { id: 'n2', type: 'transform' as const, capability: 'audio.denoise', params: {} },
        { id: 'n3', type: 'transform' as const, capability: 'image.compress', params: {} },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    }, {
      resolveCapability: resolveCap,
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

// ─── Phase 2: fan-out 节点支持 ─────────────────────────────

describe('Phase 2 fan-out 节点校验', () => {
  /** 合法 fan-out:resize → fan-out → [compress, watermark] 两并行分支 */
  const fanOutWorkflow = {
    ...validWorkflow,
    nodes: [
      { id: 'n1', type: 'transform' as const, capability: 'image.resize', params: {} },
      { id: 'fan', type: 'fan-out' as const },
      { id: 'n2', type: 'transform' as const, capability: 'image.compress', params: {} },
      { id: 'n3', type: 'transform' as const, capability: 'image.watermark', params: {} },
    ],
    edges: [
      { from: 'n1', to: 'fan' },
      { from: 'fan', to: 'n2' },
      { from: 'fan', to: 'n3' },
    ],
  };

  it('合法 fan-out(2 条出边,2 并行分支)应通过', () => {
    const result = validateWorkflow(fanOutWorkflow);
    expect(result.success).toBe(true);
  });

  it('fan-out 节点带 capability 应失败(结构节点,不引用能力)', () => {
    const result = validateWorkflow({
      ...fanOutWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'fan', type: 'fan-out', capability: 'image.resize' },
        { id: 'n2', type: 'transform', capability: 'image.compress', params: {} },
        { id: 'n3', type: 'transform', capability: 'image.watermark', params: {} },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/fan-out.*must not.*capability|capability.*fan-out/i);
    }
  });

  it('fan-out 节点仅 1 条出边应失败(无并行意义)', () => {
    const result = validateWorkflow({
      ...fanOutWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'fan', type: 'fan-out' },
        { id: 'n2', type: 'transform', capability: 'image.compress', params: {} },
      ],
      edges: [
        { from: 'n1', to: 'fan' },
        { from: 'fan', to: 'n2' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/fan-out.*at least 2|fan-out.*≥\s*2|fan-out.*2.*outgoing/i);
    }
  });

  it('fan-out 节点 0 条出边应失败', () => {
    const result = validateWorkflow({
      ...fanOutWorkflow,
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'fan', type: 'fan-out' },
      ],
      edges: [{ from: 'n1', to: 'fan' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join('; ');
      expect(msg).toMatch(/fan-out.*at least 2|fan-out.*≥\s*2|fan-out.*2.*outgoing/i);
    }
  });

  it('fan-out 节点作为入口(入度 0)且有 2 条出边应通过', () => {
    const result = validateWorkflow({
      ...fanOutWorkflow,
      nodes: [
        { id: 'fan', type: 'fan-out' },
        { id: 'n2', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n3', type: 'transform', capability: 'image.watermark', params: {} },
      ],
      edges: [
        { from: 'fan', to: 'n2' },
        { from: 'fan', to: 'n3' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('fan-out 3 条出边(三平台并行)应通过', () => {
    const result = validateWorkflow({
      ...fanOutWorkflow,
      nodes: [
        { id: 'fan', type: 'fan-out' },
        { id: 'a', type: 'transform', capability: 'image.resize', params: { width: 1080 } },
        { id: 'b', type: 'transform', capability: 'image.resize', params: { width: 720 } },
        { id: 'c', type: 'transform', capability: 'image.resize', params: { width: 480 } },
      ],
      edges: [
        { from: 'fan', to: 'a' },
        { from: 'fan', to: 'b' },
        { from: 'fan', to: 'c' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('fan-out 节点不应被 maxSteps 误判(transform 计数),但仍计入总节点数', () => {
    // 4 节点(含 1 fan-out),maxSteps=4 应通过
    const result = validateWorkflow(fanOutWorkflow, { maxSteps: 4 });
    expect(result.success).toBe(true);
    // 4 节点,maxSteps=3 应失败(节点总数超限)
    const result2 = validateWorkflow(fanOutWorkflow, { maxSteps: 3 });
    expect(result2.success).toBe(false);
  });
});

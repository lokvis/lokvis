/**
 * `lokvis validate <workflow.json>` 命令单元测试
 *
 * 验证 validateWorkflowFile 的:
 * 1. 文件不存在 → valid=false + 错误消息
 * 2. JSON 解析失败 → valid=false + 错误消息
 * 3. Zod 形状校验失败 → valid=false + 错误列表
 * 4. 结构层校验失败(DAG 环/edge 引用/保留字) → valid=false
 * 5. 校验成功 → valid=true + summary
 * 6. --max-steps 选项
 * 7. formatValidateResult 格式化
 *
 * 使用真实 fs 写入临时 fixture 文件,不 mock schema(验证真实的 zod + 结构校验链路)。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateWorkflowFile,
  formatValidateResult,
} from '../../commands/validate.js';
import type { ValidateResult } from '../../commands/validate.js';

/** 构造合法 Workflow JSON 对象 */
function makeWorkflow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'wf-test',
    version: '1.0.0',
    name: 'Test Workflow',
    description: 'for testing',
    author: { id: 'tester', name: 'tester' },
    category: 'other',
    tags: [],
    nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize' }],
    edges: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
    ...overrides,
  };
}

describe('validateWorkflowFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-validate-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('文件不存在', () => {
    it('应返回 valid=false 与 "Workflow file not found" 错误', async () => {
      const missing = join(tmpDir, 'missing.json');
      const result = await validateWorkflowFile(missing);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain('Workflow file not found');
      expect(result.errors[0]!.message).toContain(missing);
      expect(result.summary).toBeUndefined();
    });
  });

  describe('JSON 解析', () => {
    it('非法 JSON 应返回 valid=false + "Invalid workflow JSON" 错误', async () => {
      const p = join(tmpDir, 'bad.json');
      await writeFile(p, '{ not valid json }', 'utf-8');
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.message).toMatch(/Invalid workflow JSON:/);
    });

    it('JSON 为 null 应返回 valid=false', async () => {
      const p = join(tmpDir, 'null.json');
      await writeFile(p, 'null', 'utf-8');
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Expected object'))).toBe(true);
    });
  });

  describe('Zod 形状校验', () => {
    it('缺少 id 应返回错误列表', async () => {
      const wf = makeWorkflow();
      delete wf.id;
      const p = join(tmpDir, 'wf.json');
      await writeFile(p, JSON.stringify(wf), 'utf-8');
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'id')).toBe(true);
    });

    it('缺少 nodes 应返回错误', async () => {
      const wf = makeWorkflow();
      delete wf.nodes;
      const p = join(tmpDir, 'wf.json');
      await writeFile(p, JSON.stringify(wf), 'utf-8');
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'nodes')).toBe(true);
    });

    it('transform 节点缺少 capability 应返回错误', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(
        p,
        JSON.stringify(makeWorkflow({ nodes: [{ id: 'n1', type: 'transform' }] })),
        'utf-8'
      );
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('transform 节点必须指定 capability'))).toBe(true);
    });
  });

  describe('结构层校验', () => {
    it('保留字 node id 应返回错误', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(
        p,
        JSON.stringify(
          makeWorkflow({
            nodes: [{ id: '__input__', type: 'transform', capability: 'image.resize' }],
          })
        ),
        'utf-8'
      );
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('reserved'))).toBe(true);
    });

    it('edge 引用未知节点应返回错误', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(
        p,
        JSON.stringify(
          makeWorkflow({
            nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize' }],
            edges: [{ from: 'n1', to: 'nonexistent' }],
          })
        ),
        'utf-8'
      );
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('unknown target node'))).toBe(true);
    });

    it('DAG 环应返回错误', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(
        p,
        JSON.stringify(
          makeWorkflow({
            nodes: [
              { id: 'n1', type: 'transform', capability: 'image.resize' },
              { id: 'n2', type: 'transform', capability: 'image.compress' },
            ],
            edges: [
              { from: 'n1', to: 'n2' },
              { from: 'n2', to: 'n1' },
            ],
          })
        ),
        'utf-8'
      );
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('cycle'))).toBe(true);
    });
  });

  describe('校验成功', () => {
    it('合法 workflow 应返回 valid=true + summary', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(p, JSON.stringify(makeWorkflow()), 'utf-8');
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.summary).toBeDefined();
      expect(result.summary!.id).toBe('wf-test');
      expect(result.summary!.name).toBe('Test Workflow');
      expect(result.summary!.version).toBe('1.0.0');
      expect(result.summary!.category).toBe('other');
      expect(result.summary!.nodeCount).toBe(1);
      expect(result.summary!.edgeCount).toBe(0);
      expect(result.summary!.inputsType).toBe('image');
      expect(result.summary!.outputsType).toBe('image');
    });

    it('多节点 + 多 edge 的 workflow 应正确计数', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(
        p,
        JSON.stringify(
          makeWorkflow({
            nodes: [
              { id: 'n1', type: 'transform', capability: 'image.resize' },
              { id: 'n2', type: 'transform', capability: 'image.compress' },
              { id: 'n3', type: 'transform', capability: 'image.convert' },
            ],
            edges: [
              { from: 'n1', to: 'n2' },
              { from: 'n2', to: 'n3' },
            ],
          })
        ),
        'utf-8'
      );
      const result = await validateWorkflowFile(p);
      expect(result.valid).toBe(true);
      expect(result.summary!.nodeCount).toBe(3);
      expect(result.summary!.edgeCount).toBe(2);
    });
  });

  describe('--max-steps 选项', () => {
    it('节点数超过 max-steps 应返回错误', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(
        p,
        JSON.stringify(
          makeWorkflow({
            nodes: [
              { id: 'n1', type: 'transform', capability: 'image.resize' },
              { id: 'n2', type: 'transform', capability: 'image.compress' },
              { id: 'n3', type: 'transform', capability: 'image.convert' },
            ],
          })
        ),
        'utf-8'
      );
      const result = await validateWorkflowFile(p, { maxSteps: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('exceeds max 2'))).toBe(true);
    });

    it('节点数等于 max-steps 应通过', async () => {
      const p = join(tmpDir, 'wf.json');
      await writeFile(
        p,
        JSON.stringify(
          makeWorkflow({
            nodes: [
              { id: 'n1', type: 'transform', capability: 'image.resize' },
              { id: 'n2', type: 'transform', capability: 'image.compress' },
            ],
          })
        ),
        'utf-8'
      );
      const result = await validateWorkflowFile(p, { maxSteps: 2 });
      expect(result.valid).toBe(true);
    });
  });
});

describe('formatValidateResult', () => {
  it('valid=true 应输出 ✓ 与 summary 字段', () => {
    const result: ValidateResult = {
      valid: true,
      errors: [],
      summary: {
        id: 'wf-1',
        name: 'Test',
        version: '1.0.0',
        category: 'image',
        nodeCount: 3,
        edgeCount: 2,
        inputsType: 'image',
        outputsType: 'image',
      },
    };
    const out = formatValidateResult(result);
    expect(out).toContain('✓ Workflow is valid');
    expect(out).toContain('id:          wf-1');
    expect(out).toContain('name:        Test');
    expect(out).toContain('version:     1.0.0');
    expect(out).toContain('category:    image');
    expect(out).toContain('nodes:       3');
    expect(out).toContain('edges:       2');
    expect(out).toContain('inputs:      image');
    expect(out).toContain('outputs:     image');
  });

  it('valid=true 且无 summary 应仅输出 ✓', () => {
    const result: ValidateResult = { valid: true, errors: [] };
    const out = formatValidateResult(result);
    expect(out).toContain('✓ Workflow is valid');
  });

  it('valid=false 应输出 ✗ 与错误列表', () => {
    const result: ValidateResult = {
      valid: false,
      errors: [
        { path: 'id', message: 'Required' },
        { path: 'nodes.0.capability', message: 'Required' },
        { path: '', message: 'Workflow contains a cycle' },
      ],
    };
    const out = formatValidateResult(result);
    expect(out).toContain('✗ Workflow is invalid');
    expect(out).toContain('id: Required');
    expect(out).toContain('nodes.0.capability: Required');
    expect(out).toContain('Workflow contains a cycle');
  });
});

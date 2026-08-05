import { describe, it, expect } from 'vitest';
import { buildLinearWorkflow, type BuildLinearWorkflowNode } from '../build-linear-workflow.js';
import { MAX_WORKFLOW_STEPS } from '@lokvis/schema';

function makeNodes(count: number): BuildLinearWorkflowNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    capability: 'image.resize',
    params: { width: 100 * (i + 1) },
  }));
}

describe('buildLinearWorkflow', () => {
  it('应从单节点构建线性 Workflow', () => {
    const wf = buildLinearWorkflow([{ id: 'n0', capability: 'image.resize' }], 'image');
    expect(wf.nodes).toHaveLength(1);
    expect(wf.edges).toHaveLength(0);
    expect(wf.nodes[0]!.type).toBe('transform');
    expect(wf.nodes[0]!.capability).toBe('image.resize');
  });

  it('应为多节点生成正确的线性边', () => {
    const nodes = makeNodes(3);
    const wf = buildLinearWorkflow(nodes, 'image');
    expect(wf.nodes).toHaveLength(3);
    expect(wf.edges).toEqual([
      { from: 'n0', to: 'n1' },
      { from: 'n1', to: 'n2' },
    ]);
  });

  it('应正确映射 AssetType 到 WorkflowCategory', () => {
    expect(buildLinearWorkflow(makeNodes(1), 'image').category).toBe('image');
    expect(buildLinearWorkflow(makeNodes(1), 'video').category).toBe('video');
    expect(buildLinearWorkflow(makeNodes(1), 'pdf').category).toBe('pdf');
    expect(buildLinearWorkflow(makeNodes(1), 'audio').category).toBe('audio');
    expect(buildLinearWorkflow(makeNodes(1), 'data').category).toBe('data');
    expect(buildLinearWorkflow(makeNodes(1), 'text').category).toBe('other');
    expect(buildLinearWorkflow(makeNodes(1), 'unknown').category).toBe('other');
  });

  it('应设置 version 为 1.0.0', () => {
    const wf = buildLinearWorkflow(makeNodes(1), 'image');
    expect(wf.version).toBe('1.0.0');
  });

  it('应设置 inputs/outputs 类型与输入一致', () => {
    const wf = buildLinearWorkflow(makeNodes(1), 'pdf');
    expect(wf.inputs.type).toBe('pdf');
    expect(wf.inputs.multiple).toBe(true);
    expect(wf.outputs.type).toBe('pdf');
  });

  it('节点数超过 MAX_WORKFLOW_STEPS 时应抛错', () => {
    expect(() => buildLinearWorkflow(makeNodes(MAX_WORKFLOW_STEPS + 1), 'image')).toThrow(
      /exceeds max/
    );
  });

  it('空节点列表应抛错', () => {
    expect(() => buildLinearWorkflow([], 'image')).toThrow(/empty/);
  });

  it('应保留节点的 params', () => {
    const wf = buildLinearWorkflow(
      [{ id: 'n0', capability: 'image.resize', params: { width: 800, fit: 'inside' } }],
      'image'
    );
    expect(wf.nodes[0]!.params).toEqual({ width: 800, fit: 'inside' });
  });

  it('id 应以 wf_ 前缀生成', () => {
    const wf = buildLinearWorkflow(makeNodes(1), 'image');
    expect(wf.id).toMatch(/^wf_/);
  });
});

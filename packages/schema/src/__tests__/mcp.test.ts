/**
 * MCP 相关类型与函数测试
 *
 * 覆盖:
 * - workflowToAiInstruction:Workflow → AI 指令转换
 * - McpManifest / McpToolManifest / McpResourceManifest 类型(编译时保证)
 */
import { describe, it, expect } from 'vitest';
import {
  workflowToAiInstruction,
  type Workflow,
  type McpManifest,
  type McpToolManifest,
  type McpResourceManifest,
} from '../index.js';

/** 构造测试用 Workflow */
function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'wf-test',
    version: '1.0.0',
    name: 'resize-then-compress',
    description: 'test workflow',
    author: { id: 'a', name: 'tester' },
    category: 'image',
    tags: [],
    nodes: [
      { id: 'n1', type: 'transform', capability: 'image.resize', params: { width: 100 } },
      { id: 'n2', type: 'transform', capability: 'image.compress', params: { quality: 80 } },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image', format: 'png' },
    ...overrides,
  };
}

describe('workflowToAiInstruction', () => {
  it('应生成人类可读的指令描述,含节点数与名称', () => {
    const wf = makeWorkflow();
    const instr = workflowToAiInstruction(wf);

    expect(instr.instruction).toContain('2-step');
    expect(instr.instruction).toContain('resize-then-compress');
    expect(instr.instruction).toContain('image.resize');
    expect(instr.instruction).toContain('image.compress');
    expect(instr.instruction).toContain('"width":100');
    expect(instr.instruction).toContain('"quality":80');
    expect(instr.instruction).toContain('→');
  });

  it('应收集依赖的 capability 名(去重,保留顺序)', () => {
    const wf = makeWorkflow({
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n2', type: 'transform', capability: 'image.compress', params: {} },
        { id: 'n3', type: 'transform', capability: 'image.resize', params: {} }, // 重复
        { id: 'n4', type: 'transform', capability: 'image.watermark', params: {} },
      ],
    });
    const instr = workflowToAiInstruction(wf);

    expect(instr.capabilities).toEqual([
      'image.resize',
      'image.compress',
      'image.watermark',
    ]);
  });

  it('应生成输入参数 JSON Schema', () => {
    const wf = makeWorkflow();
    const instr = workflowToAiInstruction(wf);

    expect(instr.inputSchema).toHaveProperty('type', 'object');
    expect(instr.inputSchema).toHaveProperty('properties');
    expect(instr.inputSchema).toHaveProperty('required', ['input_path']);
  });

  it('multiple=true 时 input_path 应为 array 类型', () => {
    const wf = makeWorkflow({
      inputs: { type: 'image', multiple: true, maxCount: 50 },
    });
    const instr = workflowToAiInstruction(wf);
    const props = (instr.inputSchema as { properties: Record<string, { type: string }> }).properties;
    expect(props.input_path.type).toBe('array');
  });

  it('应包含示例调用', () => {
    const wf = makeWorkflow();
    const instr = workflowToAiInstruction(wf);

    expect(instr.example.input).toHaveProperty('input_path');
    expect(typeof instr.example.expectedOutput).toBe('string');
  });

  it('节点无 capability 时应被 filter 跳过(steps 中),但节点数仍计入总数', () => {
    const wf = makeWorkflow({
      nodes: [
        { id: 'n1', type: 'transform', capability: 'image.resize', params: {} },
        { id: 'n2', type: 'transform' }, // 无 capability(load 节点)
      ],
    });
    const instr = workflowToAiInstruction(wf);

    // 总节点数 2,但 steps 只含 1 个(有 capability 的)
    expect(instr.instruction).toContain('2-step');
    expect(instr.capabilities).toEqual(['image.resize']);
    // steps 拼接中应只有 image.resize 一项
    expect((instr.instruction.match(/image\.\w+/g) ?? []).length).toBe(1);
  });
});

describe('MCP 类型(编译时类型检查)', () => {
  it('McpToolManifest 应可构造且字段类型正确', () => {
    const tool: McpToolManifest = {
      name: 'lokvis_image_resize',
      description: 'Resize image',
      inputSchema: { type: 'object', properties: {} },
      capabilities: ['image.resize'],
    };
    expect(tool.name).toBe('lokvis_image_resize');
    expect(tool.capabilities).toHaveLength(1);
  });

  it('McpResourceManifest 应可构造', () => {
    const res: McpResourceManifest = {
      uri: 'lokvis://capabilities',
      name: 'Capabilities',
      description: 'List capabilities',
      mimeType: 'application/json',
    };
    expect(res.uri).toBe('lokvis://capabilities');
  });

  it('McpManifest 应包含 serverName/version/tools/resources', () => {
    const manifest: McpManifest = {
      serverName: 'lokvis',
      version: '0.1.0',
      tools: [],
      resources: [],
    };
    expect(manifest.serverName).toBe('lokvis');
    expect(manifest.tools).toEqual([]);
    expect(manifest.resources).toEqual([]);
  });
});

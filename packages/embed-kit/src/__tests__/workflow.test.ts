import { describe, it, expect } from 'vitest';
import { makeSingleStepWorkflowBuilder } from '../workflow.js';

const config = {
  category: 'pdf' as const,
  inputType: 'pdf' as const,
  outputType: 'pdf' as const,
  authorId: 'embed-pdf',
  authorName: 'Embed PDF',
};

describe('makeSingleStepWorkflowBuilder', () => {
  const build = makeSingleStepWorkflowBuilder(config);

  it('应生成包含单个 transform 节点的 Workflow', () => {
    const wf = build('pdf.merge', {}, 'Merge PDFs');
    expect(wf.nodes).toHaveLength(1);
    expect(wf.nodes[0]!.type).toBe('transform');
    expect(wf.nodes[0]!.capability).toBe('pdf.merge');
    expect(wf.edges).toHaveLength(0);
  });

  it('应使用配置中的 category / author / inputType / outputType', () => {
    const wf = build('pdf.split', { pagesPerFile: 1 }, 'Split PDF');
    expect(wf.category).toBe('pdf');
    expect(wf.author).toEqual({ id: 'embed-pdf', name: 'Embed PDF' });
    expect(wf.inputs.type).toBe('pdf');
    expect(wf.outputs.type).toBe('pdf');
  });

  it('name 应传递到 workflow.name', () => {
    const wf = build('pdf.compress', {}, 'Compress PDF');
    expect(wf.name).toBe('Compress PDF');
  });

  it('description 缺省时应回落到 name', () => {
    const wf = build('pdf.compress', {}, 'Compress PDF');
    expect(wf.description).toBe('Compress PDF');
  });

  it('传入 description 时应使用传入值', () => {
    const wf = build('pdf.compress', {}, 'Compress PDF', 'Reduce file size');
    expect(wf.description).toBe('Reduce file size');
  });

  it('multiple 默认应为 false', () => {
    const wf = build('pdf.compress', {}, 'Compress');
    expect(wf.inputs.multiple).toBe(false);
  });

  it('multiple 传 true 时应反映到 inputs', () => {
    const wf = build('pdf.merge', {}, 'Merge', undefined, true);
    expect(wf.inputs.multiple).toBe(true);
  });

  it('params 应传递到节点', () => {
    const wf = build('pdf.rotate', { angle: 90 }, 'Rotate');
    expect(wf.nodes[0]!.params).toEqual({ angle: 90 });
  });

  it('id 应以 name 小写为前缀', () => {
    const wf = build('pdf.compress', {}, 'Compress PDF');
    expect(wf.id).toMatch(/^compress pdf-/);
  });
});

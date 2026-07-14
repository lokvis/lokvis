/**
 * WorkflowBuilder 单元测试(W10.1)
 *
 * 覆盖:
 * - 链式 add / remove / move / swap / updateParams
 * - 5 步上限校验
 * - build() 校验(空节点 / 输入未设置 / 输出未设置)
 * - workflowToBuilder 反向构造
 * - 线性 edges 自动生成
 */
import { describe, it, expect } from 'vitest';
import { WorkflowBuilder, workflowToBuilder } from '../workflow-builder.js';
import { MAX_WORKFLOW_STEPS, validateWorkflow } from '@lokvis/schema';

describe('WorkflowBuilder', () => {
  describe('链式 API', () => {
    it('链式 add 应构造线性 Workflow', () => {
      const wf = new WorkflowBuilder({ id: 'wf-test', name: 'Test' })
        .setInput({ type: 'image', multiple: true })
        .setOutput({ type: 'image', format: 'webp' })
        .add('image.resize', { width: 1920 })
        .add('image.compress', { quality: 80 })
        .build();

      expect(wf.nodes).toHaveLength(2);
      expect(wf.nodes[0]!.capability).toBe('image.resize');
      expect(wf.nodes[1]!.capability).toBe('image.compress');
      expect(wf.edges).toHaveLength(1);
      expect(wf.edges[0]).toEqual({ from: wf.nodes[0]!.id, to: wf.nodes[1]!.id });
    });

    it('add 应返回 this 支持链式调用', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' });
      const result = builder.add('image.resize');
      expect(result).toBe(builder);
    });

    it('setInput / setOutput 应返回 this', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' });
      expect(builder.setInput({ type: 'image', multiple: false })).toBe(builder);
      expect(builder.setOutput({ type: 'image' })).toBe(builder);
    });

    it('build 的工作流应通过 validateWorkflow 校验', () => {
      const wf = new WorkflowBuilder({ id: 'wf-valid', name: 'Valid' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize', { width: 800 })
        .build();

      const result = validateWorkflow(wf);
      expect(result.success).toBe(true);
    });
  });

  describe('5 步上限校验', () => {
    it('MAX_WORKFLOW_STEPS 应为 5', () => {
      expect(MAX_WORKFLOW_STEPS).toBe(5);
    });

    it('添加第 6 个节点应抛错', () => {
      const builder = new WorkflowBuilder({ id: 'wf-5', name: 'Five' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .add('image.compress')
        .add('image.watermark')
        .add('image.crop')
        .add('image.rotate');

      expect(() => builder.add('image.filter')).toThrow(/max steps.*5.*reached/i);
    });

    it('isFull 在达到上限时应为 true', () => {
      const builder = new WorkflowBuilder({ id: 'wf-5', name: 'Five' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('a')
        .add('b')
        .add('c')
        .add('d')
        .add('e');
      expect(builder.isFull).toBe(true);
      expect(builder.size).toBe(5);
    });

    it('maxSteps 选项可自定义上限', () => {
      const builder = new WorkflowBuilder({ id: 'wf-3', name: 'Three', maxSteps: 3 })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('a')
        .add('b')
        .add('c');
      expect(builder.isFull).toBe(true);
      expect(() => builder.add('d')).toThrow(/max steps.*3/i);
    });
  });

  describe('remove', () => {
    it('按 capability 移除节点', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .add('image.compress');
      builder.remove('image.resize');
      expect(builder.size).toBe(1);
      expect(builder.getNodes()[0]!.capability).toBe('image.compress');
    });

    it('按节点 id 移除', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .add('image.compress');
      const firstId = builder.getNodes()[0]!.id;
      builder.remove(firstId);
      expect(builder.size).toBe(1);
    });

    it('移除不存在的节点应静默', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize');
      expect(() => builder.remove('nonexistent')).not.toThrow();
      expect(builder.size).toBe(1);
    });

    it('多个同 capability 节点只移除第一个', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .add('image.compress')
        .add('image.resize');
      builder.remove('image.resize');
      expect(builder.size).toBe(2);
      expect(builder.getNodes()[1]!.capability).toBe('image.resize');
    });
  });

  describe('move / swap', () => {
    it('move 把节点从 from 移到 to', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('a')
        .add('b')
        .add('c');
      builder.move(0, 2);
      expect(builder.getNodes().map((n) => n.capability)).toEqual(['b', 'c', 'a']);
    });

    it('move 索引越界应抛错', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('a')
        .add('b');
      expect(() => builder.move(-1, 0)).toThrow(/from index.*out of range/i);
      expect(() => builder.move(0, 5)).toThrow(/to index.*out of range/i);
    });

    it('move 相同位置应无操作', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('a')
        .add('b');
      builder.move(0, 0);
      expect(builder.getNodes().map((n) => n.capability)).toEqual(['a', 'b']);
    });

    it('swap 交换两个节点', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('a')
        .add('b')
        .add('c');
      builder.swap(0, 2);
      expect(builder.getNodes().map((n) => n.capability)).toEqual(['c', 'b', 'a']);
    });
  });

  describe('updateParams', () => {
    it('更新指定节点的参数', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize', { width: 800 });
      const nodeId = builder.getNodes()[0]!.id;
      builder.updateParams(nodeId, { height: 600 });
      expect(builder.getNodes()[0]!.params).toEqual({ width: 800, height: 600 });
    });

    it('更新不存在的节点应静默', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize');
      expect(() => builder.updateParams('nonexistent', { foo: 1 })).not.toThrow();
    });
  });

  describe('build 校验', () => {
    it('空节点应抛错', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' });
      expect(() => builder.build()).toThrow(/no nodes added/i);
    });

    it('未设置 input 应抛错', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setOutput({ type: 'image' })
        .add('image.resize');
      expect(() => builder.build()).toThrow(/input not set/i);
    });

    it('未设置 output 应抛错', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .add('image.resize');
      expect(() => builder.build()).toThrow(/output not set/i);
    });

    it('add 空 capability 应抛错', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' });
      expect(() => builder.add('')).toThrow(/capability is required/i);
    });
  });

  describe('构造选项', () => {
    it('缺少 id 应抛错', () => {
      expect(() => new WorkflowBuilder({ name: 'A' } as never)).toThrow(/id is required/i);
    });

    it('缺少 name 应抛错', () => {
      expect(() => new WorkflowBuilder({ id: 'wf-1' } as never)).toThrow(/name is required/i);
    });

    it('description 默认空字符串', () => {
      const wf = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .build();
      expect(wf.description).toBe('');
    });

    it('tags 默认空数组', () => {
      const wf = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .build();
      expect(wf.tags).toEqual([]);
    });

    it('official 默认 false', () => {
      const wf = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .build();
      expect(wf.official).toBe(false);
    });

    it('author 默认 Local User', () => {
      const wf = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .build();
      expect(wf.author).toEqual({ id: 'local', name: 'Local User' });
    });

    it('category 默认 image', () => {
      const wf = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize')
        .build();
      expect(wf.category).toBe('image');
    });
  });

  describe('节点 id 生成', () => {
    it('节点 id 应基于工作流 id 递增', () => {
      const builder = new WorkflowBuilder({ id: 'wf-mine', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('a')
        .add('b');
      const ids = builder.getNodes().map((n) => n.id);
      expect(ids[0]).toBe('wf-mine-node-1');
      expect(ids[1]).toBe('wf-mine-node-2');
    });
  });

  describe('label', () => {
    it('add 第三个参数设置 label', () => {
      const builder = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize', {}, 'Resize');
      expect(builder.getNodes()[0]!.label).toBe('Resize');
    });

    it('build 后节点保留 label', () => {
      const wf = new WorkflowBuilder({ id: 'wf-1', name: 'A' })
        .setInput({ type: 'image', multiple: false })
        .setOutput({ type: 'image' })
        .add('image.resize', {}, 'Resize Step')
        .build();
      expect(wf.nodes[0]!.label).toBe('Resize Step');
    });
  });
});

describe('workflowToBuilder', () => {
  it('从 Workflow 反向构造 Builder', () => {
    const original = new WorkflowBuilder({ id: 'wf-orig', name: 'Original' })
      .setInput({ type: 'image', multiple: true })
      .setOutput({ type: 'image', format: 'webp' })
      .add('image.resize', { width: 1920 })
      .add('image.compress', { quality: 80 })
      .build();

    const builder = workflowToBuilder(original);
    const rebuilt = builder.build();

    expect(rebuilt.nodes).toHaveLength(2);
    expect(rebuilt.nodes[0]!.capability).toBe('image.resize');
    expect(rebuilt.nodes[1]!.capability).toBe('image.compress');
    expect(rebuilt.inputs).toEqual(original.inputs);
    expect(rebuilt.outputs).toEqual(original.outputs);
  });

  it('workflowToBuilder 应跳过 load/export 节点', () => {
    const original = new WorkflowBuilder({ id: 'wf-orig', name: 'Original' })
      .setInput({ type: 'image', multiple: false })
      .setOutput({ type: 'image' })
      .add('image.resize')
      .build();
    // 手动加一个 load 节点(模拟混合)
    original.nodes.push({ id: 'loader', type: 'load' });

    const builder = workflowToBuilder(original);
    expect(builder.size).toBe(1);
    expect(builder.getNodes()[0]!.capability).toBe('image.resize');
  });

  it('workflowToBuilder 的 maxSteps 可覆盖', () => {
    const original = new WorkflowBuilder({ id: 'wf-orig', name: 'Original', maxSteps: 3 })
      .setInput({ type: 'image', multiple: false })
      .setOutput({ type: 'image' })
      .add('a')
      .add('b')
      .add('c')
      .build();

    // 反向构造时放宽到 10
    const builder = workflowToBuilder(original, 10);
    expect(() => builder.add('d')).not.toThrow();
  });
});

/**
 * WorkflowBuilder - 线性工作流链式构造器(W10.1)
 *
 * 提供链式 API 构造线性 Workflow(第一年不支持 Branch/Loop/Condition/Parallel)。
 *
 * 限制:
 *   - 最多 5 步(M1 MVP 约束,免费用户定位,避免复杂度过高)
 *   - 节点必须为 transform 类型(load/export 由执行器隐式处理)
 *   - 自动生成线性 edges:node[i] → node[i+1]
 *
 * 使用示例:
 * ```typescript
 * const workflow = new WorkflowBuilder('my-workflow', 'Web 优化')
 *   .setInput({ type: 'image', multiple: true })
 *   .setOutput({ type: 'image', format: 'webp' })
 *   .add('image.resize', { width: 1920, fit: 'inside' })
 *   .add('image.compress', { format: 'webp', quality: 80 })
 *   .add('image.watermark', { text: '@lokvis' })
 *   .build();
 * ```
 *
 * 与 workflow-slice 的 buildLinearWorkflow 区别:
 *   - buildLinearWorkflow 是内部工具函数,从 WorkspaceNode[] 构造无校验
 *   - WorkflowBuilder 是公开 API,链式调用 + 5 步上限校验 + 元数据完善
 *
 * @module workflow-builder
 */

import type {
  AssetType,
  Workflow,
  WorkflowAuthor,
  WorkflowCategory,
  WorkflowEdge,
  WorkflowInput,
  WorkflowNode,
  WorkflowOutput,
} from '@lokvis/schema';

/** 工作流最大节点数(M1 MVP 约束) */
export const MAX_WORKFLOW_STEPS = 5;

/** Builder 内部节点结构(构造中,与 WorkflowNode 略有差异:label 可独立设置) */
interface BuilderNode {
  /** 内部生成的节点 id(builder 内部唯一) */
  id: string;
  capability: string;
  params: Record<string, unknown>;
  label?: string;
}

/** WorkflowBuilder 构造选项 */
export interface WorkflowBuilderOptions {
  /** 工作流 ID(必填,需全局唯一) */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流描述(可选,默认为空字符串) */
  description?: string;
  /** 作者信息(可选,默认本地用户) */
  author?: WorkflowAuthor;
  /** 分类(可选,默认 'image') */
  category?: WorkflowCategory;
  /** 标签(可选) */
  tags?: string[];
  /** 是否为官方工作流(可选,默认 false) */
  official?: boolean;
  /** 最大节点数(可选,默认 MAX_WORKFLOW_STEPS;测试或特殊场景可放宽) */
  maxSteps?: number;
}

/**
 * WorkflowBuilder - 链式构造线性 Workflow。
 *
 * 抛错时机:
 *   - add() 超过 maxSteps 时立即抛错(避免构造完才发现步数超限)
 *   - build() 在节点为空 / 输入输出未设置时抛错
 *   - remove()/move() 在节点 id 不存在时静默(链式 API 容错)
 */
export class WorkflowBuilder {
  private readonly options: WorkflowBuilderOptions;
  private readonly maxSteps: number;
  private nodes: BuilderNode[] = [];
  private input: WorkflowInput | null = null;
  private output: WorkflowOutput | null = null;
  private nodeCounter = 0;

  constructor(options: WorkflowBuilderOptions) {
    if (!options.id) throw new Error('WorkflowBuilder: id is required');
    if (!options.name) throw new Error('WorkflowBuilder: name is required');
    this.options = options;
    this.maxSteps = options.maxSteps ?? MAX_WORKFLOW_STEPS;
  }

  /** 设置工作流输入定义 */
  setInput(input: WorkflowInput): this {
    this.input = input;
    return this;
  }

  /** 设置工作流输出定义 */
  setOutput(output: WorkflowOutput): this {
    this.output = output;
    return this;
  }

  /**
   * 添加一个节点到链尾。
   *
   * @param capability 能力名,如 `image.resize`
   * @param params 能力参数(可选,默认空对象)
   * @param label 节点标签(可选,UI 显示用)
   * @throws Error 当节点数达到 maxSteps 时
   */
  add(
    capability: string,
    params: Record<string, unknown> = {},
    label?: string
  ): this {
    if (!capability) throw new Error('WorkflowBuilder.add: capability is required');
    if (this.nodes.length >= this.maxSteps) {
      throw new Error(
        `WorkflowBuilder.add: max steps (${this.maxSteps}) reached; ` +
          `cannot add more nodes. Adjust maxSteps option if needed.`
      );
    }
    this.nodeCounter += 1;
    this.nodes.push({
      id: `${this.options.id}-node-${this.nodeCounter}`,
      capability,
      params,
      label,
    });
    return this;
  }

  /**
   * 按 capability 或节点 id 移除节点。
   * 若有多个同 capability 节点,只移除第一个。
   * 若不存在则静默(链式 API 容错)。
   *
   * @param capabilityOrId 能力名或节点 id
   */
  remove(capabilityOrId: string): this {
    const idx = this.nodes.findIndex(
      (n) => n.id === capabilityOrId || n.capability === capabilityOrId
    );
    if (idx >= 0) {
      this.nodes.splice(idx, 1);
    }
    return this;
  }

  /**
   * 移动节点到新位置(线性链中重排)。
   *
   * @param from 源位置(0-based 索引)
   * @param to 目标位置(0-based 索引,移动后该节点的新位置)
   * @throws Error 当索引越界
   */
  move(from: number, to: number): this {
    if (from < 0 || from >= this.nodes.length) {
      throw new Error(`WorkflowBuilder.move: from index ${from} out of range`);
    }
    if (to < 0 || to >= this.nodes.length) {
      throw new Error(`WorkflowBuilder.move: to index ${to} out of range`);
    }
    if (from === to) return this;
    const [node] = this.nodes.splice(from, 1);
    // splice(from, 1) 在已校验的 in-range 索引上必返回 1 元素;
    // 此处显式检查以满足 noUncheckedIndexedAccess,并在不变量被打破时报错
    if (!node) {
      throw new Error(`WorkflowBuilder.move: source node at index ${from} missing`);
    }
    this.nodes.splice(to, 0, node);
    return this;
  }

  /** 交换两个节点位置 */
  swap(i: number, j: number): this {
    if (i < 0 || i >= this.nodes.length || j < 0 || j >= this.nodes.length) {
      throw new Error('WorkflowBuilder.swap: index out of range');
    }
    if (i === j) return this;
    const a = this.nodes[i];
    const b = this.nodes[j];
    // 上方范围校验保证 i / j 在界内;显式检查以满足 noUncheckedIndexedAccess
    if (!a || !b) {
      throw new Error('WorkflowBuilder.swap: node missing (invariant violated)');
    }
    this.nodes[i] = b;
    this.nodes[j] = a;
    return this;
  }

  /** 更新指定节点的参数 */
  updateParams(nodeId: string, params: Record<string, unknown>): this {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.params = { ...node.params, ...params };
    }
    return this;
  }

  /** 当前节点数 */
  get size(): number {
    return this.nodes.length;
  }

  /** 是否已达最大节点数 */
  get isFull(): boolean {
    return this.nodes.length >= this.maxSteps;
  }

  /** 获取节点的只读副本(用于 UI 预览) */
  getNodes(): ReadonlyArray<Readonly<BuilderNode>> {
    return this.nodes.map((n) => ({ ...n }));
  }

  /**
   * 构造 Workflow 实例。
   *
   * @throws Error 当节点为空 / 输入未设置 / 输出未设置
   */
  build(): Workflow {
    if (this.nodes.length === 0) {
      throw new Error('WorkflowBuilder.build: no nodes added');
    }
    if (!this.input) {
      throw new Error('WorkflowBuilder.build: input not set (call setInput first)');
    }
    if (!this.output) {
      throw new Error('WorkflowBuilder.build: output not set (call setOutput first)');
    }

    const workflowNodes: WorkflowNode[] = this.nodes.map((n) => ({
      id: n.id,
      type: 'transform' as const,
      capability: n.capability,
      params: n.params,
      label: n.label,
    }));

    const edges: WorkflowEdge[] = [];
    for (let i = 0; i < workflowNodes.length - 1; i++) {
      const fromNode = workflowNodes[i];
      const toNode = workflowNodes[i + 1];
      // 循环边界 i < length - 1 保证 i 与 i+1 均在界内;显式检查以满足 noUncheckedIndexedAccess
      if (!fromNode || !toNode) {
        throw new Error('WorkflowBuilder.build: edge node missing (invariant violated)');
      }
      edges.push({
        from: fromNode.id,
        to: toNode.id,
      });
    }

    const now = Date.now();
    return {
      $schema: `https://lokvis.dev/schemas/workflow.json`,
      id: this.options.id,
      version: '1.0.0',
      name: this.options.name,
      description: this.options.description ?? '',
      author: this.options.author ?? { id: 'local', name: 'Local User' },
      category: this.options.category ?? 'image',
      tags: this.options.tags ?? [],
      nodes: workflowNodes,
      edges,
      inputs: this.input,
      outputs: this.output,
      official: this.options.official ?? false,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** 从 Workflow 反向构造 Builder(用于编辑已有工作流) */
export function workflowToBuilder(workflow: Workflow, maxSteps?: number): WorkflowBuilder {
  const builder = new WorkflowBuilder({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    author: workflow.author,
    category: workflow.category,
    tags: workflow.tags,
    official: workflow.official,
    maxSteps,
  });
  builder.setInput(workflow.inputs);
  builder.setOutput(workflow.outputs);
  // 按拓扑顺序添加节点(线性链 nodes 数组即顺序)
  for (const node of workflow.nodes) {
    if (node.type === 'transform' && node.capability) {
      builder.add(node.capability, node.params ?? {}, node.label);
    }
  }
  return builder;
}

/** AssetType 用于类型导出(便于消费方) */
export type { AssetType };

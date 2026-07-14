/**
 * Lokvis Workflow Schema
 *
 * 第一年只支持 Linear Workflow（线性工作流）。
 * 不支持：Branch / Loop / Condition / Parallel。
 */

import type { AssetType } from './asset.js';

/** Workflow 节点类型 */
export type NodeType = 'load' | 'transform' | 'export';

/** Workflow 节点定义 */
export interface WorkflowNode {
  /** 节点唯一 ID */
  id: string;
  /** 节点类型 */
  type: NodeType;
  /**
   * 引用的能力名，如 `image.resize`。
   * 仅 `type === 'transform'` 时必填;load/export 节点可不填。
   */
  capability?: string;
  /** 能力参数 */
  params?: Record<string, unknown>;
  /** 节点标签（UI 显示用） */
  label?: string;
}

/** Workflow 边定义（第一年只支持线性链） */
export interface WorkflowEdge {
  from: string;
  to: string;
}

/** Workflow 输入定义 */
export interface WorkflowInput {
  type: AssetType;
  /** 是否允许多个输入 */
  multiple: boolean;
  /** 最大数量（multiple=true 时生效） */
  maxCount?: number;
  /** 文件类型过滤 */
  accept?: string[];
}

/**
 * Workflow 输出 target（E1：多 target 机制）。
 *
 * 一个线性 Workflow 可通过 targets 定义多个输出端口,
 * 每个 target 的 params 会浅合并到链上每个 transform 节点的 params 中
 * （target params 优先),从而用单条链产出多个不同尺寸/参数的文件。
 *
 * 典型场景：社交媒体多平台图适配（一条 resize→compress→convert 链,
 * 5 个 target 分别覆盖 width/height 产出 5 个尺寸）。
 */
export interface OutputTarget {
  /** target 名称（如 "instagram"、"twitter"），同一 outputs 内不可重复 */
  name: string;
  /** 参数覆盖（浅合并到每个 transform 节点的 params） */
  params?: Record<string, unknown>;
}

/** Workflow 输出定义 */
export interface WorkflowOutput {
  type: AssetType | 'archive';
  format?: string;
  /**
   * 多 target 输出（E1）。
   * 存在且非空时,runtime 为每个 target 独立执行一次 transform 链,
   * 产出 len(targets) 个文件。所有 target 共享同一 output type/format。
   */
  targets?: OutputTarget[];
}

/** Workflow 作者信息 */
export interface WorkflowAuthor {
  id: string;
  name: string;
}

/** Workflow 语义版本 */
export interface WorkflowVersion {
  /** semver 版本号 */
  version: string;
  /** Schema 版本 */
  schemaVersion: string;
  /** 兼容的最低 Runtime 版本 */
  runtimeVersion: string;
  changelog: string;
  createdAt: number;
  deprecated?: boolean;
}

/** Workflow 分类 */
export type WorkflowCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'ai'
  | 'data'
  | 'developer'
  | 'ecommerce'
  | 'content-creation'
  | 'other';

/** 完整 Workflow 定义 */
export interface Workflow {
  /** Schema URL */
  $schema?: string;
  /** Workflow 唯一 ID */
  id: string;
  /** 版本号 */
  version: string;
  /** 工作流名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 作者 */
  author: WorkflowAuthor;
  /** 分类 */
  category: WorkflowCategory;
  /** 标签 */
  tags: string[];
  /** 节点列表 */
  nodes: WorkflowNode[];
  /** 边列表（线性链） */
  edges: WorkflowEdge[];
  /** 输入定义 */
  inputs: WorkflowInput;
  /** 输出定义 */
  outputs: WorkflowOutput;
  /** 是否为官方工作流 */
  official?: boolean;
  /** 创建时间 */
  createdAt?: number;
  /** 更新时间 */
  updatedAt?: number;
}

/** Workflow 执行结果 */
export interface WorkflowResult {
  workflowId: string;
  /** 输出 Asset ID 列表 */
  outputs: import('./asset.js').AssetId[];
  /** 执行耗时（毫秒） */
  duration: number;
  /** 执行状态 */
  status: 'completed' | 'cancelled' | 'failed';
  /** 错误信息（status=failed 时） */
  error?: string;
}

/**
 * Workflow 的 AI 指令描述(见 docs/AI生态冲击调整方案.md §7.2)。
 * 把 Workflow JSON 转换为 AI Agent 可理解的指令格式,
 * 供 MCP server 在 prompt 模板 / resource 中暴露给 AI 客户端。
 */
export interface WorkflowAiInstruction {
  /** 人类可读的指令描述,如 "Execute 2-step workflow: image.resize with {...} → image.compress with {...}" */
  instruction: string;
  /** 涉及的 Lokvis capability 名(去重) */
  capabilities: string[];
  /** 输入参数 JSON Schema(描述 workflow 需要的输入) */
  inputSchema: object;
  /** 示例调用(供 AI 学习调用方式) */
  example: {
    input: Record<string, unknown>;
    expectedOutput: string;
  };
}

/**
 * 把 Workflow 转换为 AI 可理解的指令描述。
 *
 * 注意:此函数仅做结构转换,不执行 workflow。
 * AI 生成的 workflow 仍由确定性 Runtime 执行(见方案 §5.3 设计原则)。
 *
 * @param workflow 已定义的 Workflow
 * @returns AI 指令描述,含人类可读指令、依赖能力、输入 schema、示例
 */
export function workflowToAiInstruction(workflow: Workflow): WorkflowAiInstruction {
  const steps = workflow.nodes
    .filter((n) => n.capability)
    .map((n) => `${n.capability} with params ${JSON.stringify(n.params ?? {})}`);

  // 从节点中收集依赖的 capability 名(去重,保留顺序)
  const seen = new Set<string>();
  const capabilities: string[] = [];
  for (const node of workflow.nodes) {
    if (node.capability && !seen.has(node.capability)) {
      seen.add(node.capability);
      capabilities.push(node.capability);
    }
  }

  // 期望输出反映 workflow 实际输出类型/格式(而非硬编码占位),
  // 供 AI 理解调用后的产物。注意:此处仅描述,实际执行由确定性 Runtime 完成。
  const outputFormat = workflow.outputs.format ?? workflow.outputs.type;

  return {
    instruction:
      `Execute ${workflow.nodes.length}-step workflow "${workflow.name}": ${steps.join(' → ')}`,
    capabilities,
    inputSchema: workflowInputsToJsonSchema(workflow),
    example: {
      input: { input_path: `/path/to/input.${workflow.inputs.type}` },
      expectedOutput: `Processed ${workflow.inputs.type} saved as ${outputFormat}`,
    },
  };
}

/** 把 Workflow 的输入定义转为 JSON Schema(供 AI 理解输入约束) */
function workflowInputsToJsonSchema(workflow: Workflow): object {
  const inputDef = workflow.inputs;
  const schema: Record<string, unknown> = {
    type: 'object',
    properties: {
      input_path: {
        type: 'string',
        description: `Path or asset ID of the input ${inputDef.type} file${inputDef.multiple ? '(s)' : ''}`,
      },
    },
    required: ['input_path'],
  };
  if (inputDef.multiple) {
    (schema.properties as Record<string, unknown>).input_path = {
      type: 'array',
      items: { type: 'string' },
      description: `List of input ${inputDef.type} file paths${inputDef.maxCount ? ` (max ${inputDef.maxCount})` : ''}`,
    };
  }
  return schema;
}

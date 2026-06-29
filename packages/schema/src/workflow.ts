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
  /** 引用的能力名，如 `image.resize` */
  capability: string;
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

/** Workflow 输出定义 */
export interface WorkflowOutput {
  type: AssetType | 'archive';
  format?: string;
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

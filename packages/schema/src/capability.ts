/**
 * Lokvis Capability Model
 *
 * Runtime 永远不知道 FFmpeg，只知道 Capability。
 * Capability 由 Plugin 注册，由 Engine 实现。
 */

import type { AssetType } from './asset.js';

/** 能力名称采用点分命名：`<domain>.<action>`，如 `image.resize` */
export type CapabilityName = string;

/** 能力参数类型 */
export type CapabilityParamType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'enum'
  | 'color'
  | 'file'
  | 'array'
  | 'object';

/** 能力参数定义 */
export interface CapabilityParam {
  name: string;
  type: CapabilityParamType;
  description?: string;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  /** type === 'enum' 时的可选值 */
  values?: string[];
  /** type === 'array' 时的元素类型 */
  items?: CapabilityParamType;
}

/** 性能预估等级 */
export type PerformanceLevel = 'fast' | 'medium' | 'slow';

/**
 * 引擎选择策略(由 CapabilityRegistry 在无显式 preferredEngine 时使用):
 * - `'first'`:按注册顺序取第一个(默认,确定性高,保留旧行为)
 * - `'fastest'`:按性能等级排序取最快(fast > medium > slow,同档按注册顺序)
 * - `'balanced'`:优先取与能力声明 performance 匹配的实现;无匹配则退化为 fastest
 */
export type EngineSelectionStrategy = 'first' | 'fastest' | 'balanced';

/** 能力声明（由 Plugin 提供） */
export interface Capability {
  /** 能力名，如 `image.resize` */
  name: CapabilityName;
  description: string;
  /** 接受的输入 Asset 类型 */
  inputTypes: AssetType[];
  /** 产出的输出 Asset 类型 */
  outputTypes: AssetType[];
  /** 参数 Schema */
  params: CapabilityParam[];
  /** 性能预估，用于 UI 提示与调度优化 */
  performance: PerformanceLevel;
  /** 是否支持批量处理（一次处理多个 Asset） */
  batchable?: boolean;
}

/** 能力实现（由 Plugin 注册到 Runtime） */
export interface CapabilityImplementation {
  /** 对应的 Capability 名 */
  capability: CapabilityName;
  /** 实现该能力的引擎名 */
  engine: string;
  /**
   * 该引擎的性能等级(可选)。缺省时使用能力声明的 performance。
   * 用于 EngineSelectionStrategy('fastest'/'balanced')排序选择。
   */
  performance?: PerformanceLevel;
  /** 实际执行函数 */
  execute: (
    inputs: import('./asset.js').Asset[],
    params: Record<string, unknown>,
    context: ExecutionContext
  ) => Promise<import('./asset.js').Asset[]>;
}

/** 能力执行上下文 */
export interface ExecutionContext {
  /** 当前 Workflow ID */
  workflowId: string;
  /** 当前 Node ID */
  nodeId: string;
  /** 取消信号 */
  signal: AbortSignal;
  /** 进度回调（0-1） */
  onProgress?: (progress: number, message?: string) => void;
  /** 日志函数 */
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
}

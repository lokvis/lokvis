/**
 * @lokvis/engine-ai
 *
 * AI 能力适配层(F1 重构:从旧版 AiEngineAdapter 接口 + createEngineRegistry
 * 注册表模式迁移到独立纯函数模式,与 engine-pdf / engine-video / engine-audio
 * 对齐)。
 *
 * 双引擎定位:
 * - transformers-js(本地):ocr / caption / background-remove — 浏览器内 AI 推理
 *   (Phase 4 实装,当前 stub)
 * - cloud-proxy(云端):generate-workflow / optimize-workflow / diagnose-error
 *   — 经 cloud-bridge 转发至 lokvis-cloud(F1 实装)
 *
 * 设计原则:
 * 1. AI 只设计,不执行:生成的 workflow 由 Runtime 确定性执行
 * 2. 本地 AI 优先:transformers.js 在浏览器内运行,文件不上传
 * 3. 云端 AI 可选:cloud-proxy 需用户授权并消耗 AI Credits
 *
 * Open Core 边界:
 * - 本包只定义 cloud-proxy 操作的接口(AiCloudCaller)与浏览器 stub 实现
 * - 实际 cloud 调用由 @lokvis/cloud-bridge 的 CloudAiClient 承载
 *   (engine-ai 不依赖 cloud-bridge,避免循环依赖;由 plugin-ai 上层注入 caller)
 *
 * 实现路线:
 * - Phase 1:stub 占位(已完成)
 * - Phase 2 F1:cloud-proxy 接口 + AiCloudCaller 注入 + diagnose-error 新增
 *   (transformers-js 仍 stub,Phase 4 实装)
 *
 * O-16 主入口只暴露 Blob↔Blob 纯函数(removeBackground)。
 * ocr / caption 返回结构化对象(OcrResult / CaptionResult),违反 Blob↔Blob,
 * 已移至 `@lokvis/engine-ai/structured` 子路径。
 * cloud-proxy 操作(generateWorkflow 等)不接受 Blob 输入,是 AI 设计能力,
 * 保留在主入口供 plugin-ai 消费(非 Blob 操作的合理例外)。
 */

import type { AssetType } from '@lokvis/schema';

// ─── 类型定义 ─────────────────────────────────────────────────────

/** AI 引擎名 */
export type AiEngineName = 'transformers-js' | 'cloud-proxy';

/** cloud-proxy 引擎版本(非 stub,F1 实装后由 plugin-ai 注入 caller 即生效) */
export const CLOUD_PROXY_ENGINE_VERSION = '0.1.0';

/** transformers-js 引擎版本(stub,Phase 4 实装) */
export const TRANSFORMERS_ENGINE_VERSION = '0.0.0-stub';

/** 背景移除参数 */
export interface BackgroundRemoveParams {
  /** 输出格式（默认保留原图格式） */
  format?: 'png' | 'webp';
}

/** AI 工作流生成参数 */
export interface GenerateWorkflowParams {
  prompt: string;
  /** 上下文资产（可选） */
  contextAssetIds?: string[];
}

/** AI 工作流优化参数 */
export interface OptimizeWorkflowParams {
  /** 待优化的 workflow（对象或 JSON 字符串） */
  workflow: unknown;
  /** 优化目标提示（可选） */
  prompt?: string;
}

/** AI 错误诊断参数(F1 新增) */
export interface DiagnoseErrorParams {
  /** 错误对象(必填) */
  error: { message: string; stack?: string; code?: string };
  /** 失败的 workflow(可选上下文) */
  workflow?: unknown;
  /** 错误发生的节点 ID(可选) */
  nodeId?: string;
}

/** 错误诊断报告 */
export interface DiagnoseErrorReport {
  /** 根因分析(简短) */
  rootCause: string;
  /** 修复建议(可执行步骤) */
  remediation: string[];
  /** 相关节点 ID(如能定位) */
  suspectNodeId?: string;
  /** 严重程度 */
  severity: 'info' | 'warning' | 'error';
}

// ─── AiCloudCaller 接口(由 plugin-ai 上层注入) ────────────────────

/**
 * cloud-proxy 调用接口。
 *
 * engine-ai 不直接依赖 @lokvis/cloud-bridge(避免循环依赖与架构越界),
 * 通过此接口抽象 cloud 调用。@lokvis/cloud-bridge 的 CloudAiClient 实现
 * 了此接口(结构化类型匹配),plugin-ai 在初始化时注入。
 *
 * 未注入 caller 时,cloud-proxy 操作走 stub 路径(抛 "not implemented in stub"),
 * 保证浏览器/无 API Key 场景的 fallback 行为。
 */
export interface AiCloudCaller {
  generateWorkflow(params: GenerateWorkflowParams): Promise<unknown>;
  optimizeWorkflow(params: OptimizeWorkflowParams): Promise<unknown>;
  diagnoseError(params: DiagnoseErrorParams): Promise<DiagnoseErrorReport>;
}

// ─── Blob↔Blob 操作(transformers-js,Phase 4 实装) ──────────────

function stubMessage(operation: string, engine: string): string {
  return `${operation} not implemented in stub (${engine}). ${
    engine === 'transformers-js'
      ? 'Local AI inference is planned for Phase 4 (transformers.js).'
      : 'Use AiCloudCaller injection (via @lokvis/cloud-bridge CloudAiClient) for real cloud calls.'
  }`;
}

/**
 * 背景移除操作(浏览器 stub,Blob↔Blob)。
 *
 * Phase 4 将用 transformers.js 的 briaai/RMBG-1.4 模型实装。
 * 这是主入口中唯一符合 AGENTS.md「Engine 层 Blob↔Blob」约定的操作;
 * ocr/caption(Blob→结构化)已移至 `@lokvis/engine-ai/structured`。
 */
export async function removeBackground(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('removeBackground', 'transformers-js'));
}

// ─── cloud-proxy 操作(默认 stub,需 plugin-ai 注入 caller) ────────

/**
 * 生成 workflow(默认 stub)。
 *
 * 真实实装路径:plugin-ai 调用 `createGenerateWorkflowOperation(caller)`
 * 包装此函数,caller 由 CloudAiClient 实现。
 *
 * 直接调用(无 caller)抛 stub 错误,保证未配置 cloud 时明确降级。
 */
export async function generateWorkflow(
  _params: Record<string, any> = {}
): Promise<unknown> {
  throw new Error(stubMessage('generateWorkflow', 'cloud-proxy'));
}

/**
 * 优化 workflow(默认 stub)。
 *
 * 真实实装路径:plugin-ai 调用 `createOptimizeWorkflowOperation(caller)`
 * 包装此函数。
 */
export async function optimizeWorkflow(
  _params: Record<string, any> = {}
): Promise<unknown> {
  throw new Error(stubMessage('optimizeWorkflow', 'cloud-proxy'));
}

/**
 * 诊断 workflow 执行错误(默认 stub,F1 新增)。
 *
 * 真实实装路径:plugin-ai 调用 `createDiagnoseErrorOperation(caller)`
 * 包装此函数。
 */
export async function diagnoseError(
  _params: Record<string, any> = {}
): Promise<DiagnoseErrorReport> {
  throw new Error(stubMessage('diagnoseError', 'cloud-proxy'));
}

// ─── cloud-proxy 操作工厂(由 plugin-ai 注入 caller 时使用) ───────

/**
 * 构造真实的 generateWorkflow 操作(注入 caller)。
 *
 * plugin-ai 在有 cloudCaller 时调用此工厂,把 stub 替换为真实实装。
 */
export function createGenerateWorkflowOperation(caller: AiCloudCaller) {
  return async function generateWorkflowViaCloud(
    params: Record<string, any> = {}
  ): Promise<unknown> {
    return caller.generateWorkflow(params as GenerateWorkflowParams);
  };
}

/**
 * 构造真实的 optimizeWorkflow 操作(注入 caller)。
 */
export function createOptimizeWorkflowOperation(caller: AiCloudCaller) {
  return async function optimizeWorkflowViaCloud(
    params: Record<string, any> = {}
  ): Promise<unknown> {
    return caller.optimizeWorkflow(params as OptimizeWorkflowParams);
  };
}

/**
 * 构造真实的 diagnoseError 操作(注入 caller,F1 新增)。
 */
export function createDiagnoseErrorOperation(caller: AiCloudCaller) {
  return async function diagnoseErrorViaCloud(
    params: Record<string, any> = {}
  ): Promise<DiagnoseErrorReport> {
    return caller.diagnoseError(params as DiagnoseErrorParams);
  };
}

// ─── 引擎元数据(供 plugin-ai 检测 stub 状态) ─────────────────────

/**
 * transformers-js 引擎元数据(stub,Phase 4 实装)。
 *
 * plugin-ai 通过 version.includes('stub') 检测是否为 stub,
 * 决定 ocr / caption / background-remove 能力的 status。
 */
export const transformersEngine = {
  name: 'transformers-js' as const,
  version: TRANSFORMERS_ENGINE_VERSION,
  supportedCapabilities: ['ai.ocr', 'ai.caption', 'ai.background-remove'],
};

/**
 * cloud-proxy 引擎元数据(F1 后非 stub,但需 plugin-ai 注入 caller 才能实装)。
 *
 * 注意:version 不含 'stub',但 generateWorkflow / optimizeWorkflow /
 * diagnoseError 默认仍抛错 — plugin-ai 通过 isStub = !cloudCaller 决定
 * 这三个能力的 status(无 caller 时为 stub,有 caller 时为 stable)。
 */
export const cloudProxyEngine = {
  name: 'cloud-proxy' as const,
  version: CLOUD_PROXY_ENGINE_VERSION,
  supportedCapabilities: [
    'ai.generate-workflow',
    'ai.optimize-workflow',
    'ai.diagnose-error',
  ],
};

export type { AssetType };

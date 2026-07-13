/**
 * @lokvis/engine-ai
 *
 * AI 能力适配层。
 *
 * 定位:AI 辅助 workflow 设计,不替代确定性执行(见
 * docs/AI生态冲击调整方案.md §5)。
 * - transformersEngine:本地 AI(OCR/caption/background-remove),隐私优先
 * - cloudProxyEngine:云端 AI(generate-workflow/optimize-workflow),接 lokvis-cloud
 *
 * 设计原则:
 * 1. AI 只设计,不执行:生成的 workflow 由 Runtime 确定性执行
 * 2. 本地 AI 优先:transformers.js 在浏览器内运行,文件不上传
 * 3. 云端 AI 可选:cloudProxyEngine 需用户授权并消耗 AI Credits
 *
 * Open Core 边界:
 * - 本包(lokvis-open)只定义接口与 transformers.js 占位
 * - 实际 cloud-proxy 实现属于 lokvis-cloud,不在本仓库
 *
 * 实现路线:
 * - Phase 1:stub 占位
 * - Phase 2:实现 cloudProxyEngine 接口 + transformersEngine OCR
 */

import { createEngineRegistry } from '@lokvis/engine-core';
import type { AssetType } from '@lokvis/schema';

/** AI 引擎名 */
export type AiEngineName = 'transformers-js' | 'cloud-proxy';

/** OCR 参数 */
export interface OcrParams {
  language?: string;
  /** 输出格式 */
  format?: 'text' | 'json' | 'structured';
}

/** 字幕生成参数 */
export interface CaptionParams {
  maxTokens?: number;
  language?: string;
}

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

/** OCR 结果 */
export interface OcrResult {
  text: string;
  blocks?: Array<{ text: string; bbox: [number, number, number, number] }>;
  confidence: number;
}

/** 字幕结果 */
export interface CaptionResult {
  text: string;
  confidence: number;
}

/** AI 引擎适配器接口 */
export interface AiEngineAdapter {
  name: AiEngineName;
  version: string;
  supportedCapabilities: string[];
  isSupported(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  ocr(blob: Blob, params: Record<string, any>): Promise<OcrResult>;
  caption(blob: Blob, params: Record<string, any>): Promise<CaptionResult>;
  removeBackground(blob: Blob, params: Record<string, any>): Promise<Blob>;
  generateWorkflow(params: Record<string, any>): Promise<unknown>;
  /** 优化已有 workflow（cloud-proxy 引擎承载） */
  optimizeWorkflow(params: Record<string, any>): Promise<unknown>;
}

/** transformers.js 引擎占位实现（本地推理） */
export const transformersEngine: AiEngineAdapter = {
  name: 'transformers-js',
  version: '0.0.0-stub',
  supportedCapabilities: ['ai.ocr', 'ai.caption', 'ai.background-remove'],
  async isSupported() {
    return typeof WebAssembly !== 'undefined';
  },
  async ocr() {
    throw new Error('transformersEngine.ocr not implemented in stub');
  },
  async caption() {
    throw new Error('transformersEngine.caption not implemented in stub');
  },
  async removeBackground() {
    throw new Error('transformersEngine.removeBackground not implemented in stub');
  },
  async generateWorkflow() {
    throw new Error(
      'transformersEngine.generateWorkflow not implemented in stub (use cloud-proxy)'
    );
  },
  async optimizeWorkflow() {
    throw new Error(
      'transformersEngine.optimizeWorkflow not implemented in stub (use cloud-proxy)'
    );
  },
};

/** cloud-proxy 引擎占位实现（lokvis-cloud 提供） */
export const cloudProxyEngine: AiEngineAdapter = {
  name: 'cloud-proxy',
  version: '0.0.0-stub',
  supportedCapabilities: ['ai.generate-workflow', 'ai.optimize-workflow'],
  async isSupported() {
    // cloud-proxy 需要用户登录态（在 lokvis-cloud 验证）
    return false;
  },
  async ocr() {
    throw new Error('cloudProxyEngine.ocr not implemented in stub');
  },
  async caption() {
    throw new Error('cloudProxyEngine.caption not implemented in stub');
  },
  async removeBackground() {
    throw new Error('cloudProxyEngine.removeBackground not implemented in stub');
  },
  async generateWorkflow() {
    throw new Error(
      'cloudProxyEngine.generateWorkflow not implemented in stub (requires lokvis-cloud)'
    );
  },
  async optimizeWorkflow() {
    throw new Error(
      'cloudProxyEngine.optimizeWorkflow not implemented in stub (requires lokvis-cloud)'
    );
  },
};

// ─── 引擎注册表(委托 @lokvis/engine-core 工厂) ───────────
// 旧版手写 Map + register/get/list/selectBest 四个函数,与 engine-pdf /
// engine-audio / engine-video 完全相同。改为 createEngineRegistry 一次构造,
// 消除四份重复样板。get(name?) 未命中时 fallback 到 transformersEngine。
const registry = createEngineRegistry<AiEngineAdapter>(
  [transformersEngine, cloudProxyEngine],
  transformersEngine
);

export function registerAiEngine(engine: AiEngineAdapter): void {
  registry.register(engine);
}

export function getAiEngine(name?: AiEngineName): AiEngineAdapter {
  return registry.get(name);
}

export function listAiEngines(): AiEngineAdapter[] {
  return registry.list();
}

export async function selectBestAiEngine(): Promise<AiEngineAdapter> {
  return registry.selectBest();
}

export type { AssetType };

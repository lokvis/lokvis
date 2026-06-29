/**
 * @lokvis/engine-ai
 *
 * AI 引擎适配层。
 *
 * 计划支持的引擎：
 * - transformers.js：浏览器本地推理（OCR、图像分类、字幕生成）
 * - cloud-proxy：通过 lokvis-cloud 调用大模型（GPT-4V 等）
 *
 * Open Core 边界：
 * - 本包（lokvis-open）只定义接口与 transformers.js 占位
 * - 实际 cloud-proxy 实现属于 lokvis-cloud，不在本仓库
 *
 * 当前状态：MVP 占位实现。
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第十节「AI 集成」。
 */

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
  ocr(blob: Blob, params: OcrParams): Promise<OcrResult>;
  caption(blob: Blob, params: CaptionParams): Promise<CaptionResult>;
  removeBackground(blob: Blob, params: BackgroundRemoveParams): Promise<Blob>;
  generateWorkflow(params: GenerateWorkflowParams): Promise<unknown>;
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
    throw new Error('transformersEngine cannot generateWorkflow (use cloud-proxy)');
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
    throw new Error('cloudProxyEngine.generateWorkflow requires lokvis-cloud');
  },
};

const engines = new Map<AiEngineName, AiEngineAdapter>([
  ['transformers-js', transformersEngine],
  ['cloud-proxy', cloudProxyEngine],
]);

export function registerAiEngine(engine: AiEngineAdapter): void {
  engines.set(engine.name, engine);
}

export function getAiEngine(name?: AiEngineName): AiEngineAdapter {
  if (name) {
    const e = engines.get(name);
    if (e) return e;
  }
  return transformersEngine;
}

export function listAiEngines(): AiEngineAdapter[] {
  return Array.from(engines.values());
}

export async function selectBestAiEngine(): Promise<AiEngineAdapter> {
  for (const engine of engines.values()) {
    if (await engine.isSupported()) return engine;
  }
  return transformersEngine;
}

export type { AssetType };

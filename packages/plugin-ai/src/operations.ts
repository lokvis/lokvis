/**
 * AI Capability 实现
 *
 * 桥接 engine-ai 的 5 个 supportedCapabilities 到 Capability 层。
 * AI 能力形态异构,不像 image/video/audio 那样全是 Blob↔Blob,分三类:
 *
 * ① Blob→text(ocr / caption):transformersEngine 返回结构化对象
 *    (OcrResult / CaptionResult),桥接层提取 text 字段封装为 text/plain Blob,
 *    产出 text 类型 Asset。走 createBlobCapabilityImpl 工厂。
 *
 * ② Blob→image(background-remove):标准 Blob→Blob 变换,
 *    走 createBlobCapabilityImpl 工厂,使用 defaultDeriveOutputMetadata
 *    传播 dimensions。
 *
 * ③ params→data(generate-workflow / optimize-workflow):不接受 Asset 输入,
 *    generateWorkflow 从 params.prompt 生成 workflow,optimizeWorkflow
 *    engine-ai 尚未提供方法。两者走自定义 CapabilityImplementation。
 *
 * 注意:engine-ai 当前为占位实现,所有方法均抛出 "not implemented in stub",
 * 因此 plugin-ai 的各操作在运行时也会抛出 —— 这是有意为之的 stub 行为。
 */

import {
  createBlobCapabilityImpl,
  defaultDeriveOutputMetadata,
} from '@lokvis/plugin-sdk';
import { transformersEngine, cloudProxyEngine } from '@lokvis/engine-ai';
import type {
  Asset,
  AssetMetadata,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';

/** 单输入 → 单输出 Blob 操作(ocr / caption / background-remove) */
export type SingleAiOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** AI 能力实现项(元数据:capability → engine 映射 + stub 标识) */
export interface AiCapabilityEntry {
  /** 对应 Capability 名 */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 是否为 stub 实现(engine.version.includes('stub')) */
  isStub: boolean;
}

// ─── 引擎 stub 标识(AGENTS.md 约定:version.includes('stub')) ──
const transformersIsStub = transformersEngine.version.includes('stub');
const cloudProxyIsStub = cloudProxyEngine.version.includes('stub');

// ─── Blob 操作:ocr / caption / background-remove ──────────
// ocr / caption 的引擎返回结构化对象,桥接层提取 text 封装为 text/plain Blob。
// background-remove 是标准 Blob→Blob,直接透传。

const ocrOp: SingleAiOperation = async (blob, params) => {
  const result = await transformersEngine.ocr(blob, params);
  return new Blob([result.text], { type: 'text/plain' });
};

const captionOp: SingleAiOperation = async (blob, params) => {
  const result = await transformersEngine.caption(blob, params);
  return new Blob([result.text], { type: 'text/plain' });
};

const removeBackgroundOp: SingleAiOperation = (blob, params) =>
  transformersEngine.removeBackground(blob, params);

/** 从输出 Blob 派生 text 类型 Asset 元数据(不传播 dimensions) */
function deriveTextMetadata(_source: Asset, outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'text/plain';
  const format = mimeType.split('/')[1] ?? 'txt';
  return { mimeType, size: outBlob.size, format };
}

/** 从输出 Blob 派生 data(JSON)类型 Asset 元数据 */
function deriveJsonMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'application/json';
  const format = mimeType.split('/')[1] ?? 'json';
  return { mimeType, size: outBlob.size, format };
}

/** 全部 AI 能力实现项(列出 engine-ai 的 supportedCapabilities) */
export const AI_CAPABILITY_ENTRIES: AiCapabilityEntry[] = [
  { capability: 'ai.ocr',              engine: 'transformers-js', isStub: transformersIsStub },
  { capability: 'ai.caption',           engine: 'transformers-js', isStub: transformersIsStub },
  { capability: 'ai.background-remove', engine: 'transformers-js', isStub: transformersIsStub },
  { capability: 'ai.generate-workflow', engine: 'cloud-proxy',     isStub: cloudProxyIsStub },
  { capability: 'ai.optimize-workflow', engine: 'cloud-proxy',     isStub: cloudProxyIsStub },
];

// ─── 自定义实现:generate-workflow / optimize-workflow ──────
// 这两个能力不接受 Asset 输入,不走 createBlobCapabilityImpl 工厂。

/**
 * ai.generate-workflow 实现:从 params.prompt 生成 workflow,
 * 输出为 data 类型 Asset(workflow JSON)。
 */
function createGenerateWorkflowImpl(
  isStub: boolean,
  ctx: PluginContext
): CapabilityImplementation {
  return {
    capability: 'ai.generate-workflow',
    engine: 'cloud-proxy',
    status: isStub ? 'stub' : 'stable',
    async execute(_inputs, params, execCtx) {
      execCtx.onProgress?.(0.1, 'Generating workflow');
      // generateWorkflow 不接受 Asset 输入,使用 params.prompt
      const workflow = await cloudProxyEngine.generateWorkflow(params);
      const json = JSON.stringify(workflow, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const outAsset = await ctx.runtime.createAsset(
        blob,
        deriveJsonMetadata(blob),
        'data'
      );
      execCtx.onProgress?.(1, 'Done');
      return [outAsset];
    },
  };
}

/**
 * ai.optimize-workflow 实现:engine-ai 尚未提供 optimizeWorkflow 方法,
 * 运行时直接抛出明确错误(与 plugin-video 处理缺失引擎方法的模式一致)。
 */
function createOptimizeWorkflowImpl(isStub: boolean): CapabilityImplementation {
  return {
    capability: 'ai.optimize-workflow',
    engine: 'cloud-proxy',
    status: isStub ? 'stub' : 'stable',
    async execute() {
      throw new Error(
        'ai.optimize-workflow not implemented in engine-ai stub'
      );
    },
  };
}

/**
 * 构造所有 AI 能力的 CapabilityImplementation
 * (由 plugin.ts 在 installer 中调用)
 *
 * stub 标识已在 AI_CAPABILITY_ENTRIES 中按引擎一次性计算,
 * 不再在此处重复检测 engine.version。
 */
export function buildAiCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return [
    // ① ai.ocr — Blob→text
    createBlobCapabilityImpl(
      {
        capability: 'ai.ocr',
        engine: 'transformers-js',
        outputType: 'text',
        operation: ocrOp,
        isStub: transformersIsStub,
        deriveMetadata: deriveTextMetadata,
      },
      ctx
    ),
    // ② ai.caption — Blob→text
    createBlobCapabilityImpl(
      {
        capability: 'ai.caption',
        engine: 'transformers-js',
        outputType: 'text',
        operation: captionOp,
        isStub: transformersIsStub,
        deriveMetadata: deriveTextMetadata,
      },
      ctx
    ),
    // ③ ai.background-remove — Blob→image(标准变换,传播 dimensions)
    createBlobCapabilityImpl(
      {
        capability: 'ai.background-remove',
        engine: 'transformers-js',
        outputType: 'image',
        operation: removeBackgroundOp,
        isStub: transformersIsStub,
        deriveMetadata: defaultDeriveOutputMetadata,
      },
      ctx
    ),
    // ④ ai.generate-workflow — params→data(无 Asset 输入)
    createGenerateWorkflowImpl(cloudProxyIsStub, ctx),
    // ⑤ ai.optimize-workflow — engine-ai 尚未提供方法
    createOptimizeWorkflowImpl(cloudProxyIsStub),
  ];
}

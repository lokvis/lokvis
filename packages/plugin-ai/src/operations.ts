/**
 * AI Capability 实现(F1 重构)
 *
 * 桥接 engine-ai 的 6 个能力到 Capability 层。AI 能力形态异构,不像
 * image/video/audio 那样全是 Blob↔Blob,分三类:
 *
 * ① Blob→text(ocr / caption):transformersEngine 返回结构化对象
 *    (OcrResult / CaptionResult),桥接层提取 text 字段封装为 text/plain Blob,
 *    产出 text 类型 Asset。走 createBlobCapabilityImpl 工厂。
 *
 * ② Blob→image(background-remove):标准 Blob→Blob 变换,
 *    走 createBlobCapabilityImpl 工厂,使用 defaultDeriveOutputMetadata
 *    传播 dimensions。
 *
 * ③ params→data(generate-workflow / optimize-workflow / diagnose-error):
 *    不接受 Asset 输入,generateWorkflow 从 params.prompt 生成 workflow,
 *    optimizeWorkflow 从 params.workflow 优化,optimizeWorkflow 从
 *    params.error 诊断。三者走自定义 CapabilityImplementation。
 *
 * F1 变更:
 * - cloudProxyEngine.version 改为非 stub('0.1.0'),但默认操作仍抛错
 * - 新增 ai.diagnose-error 能力桥接(F1)
 * - aiToolsPlugin 接受可选 cloudCaller 注入:
 *   - 有 caller 时,3 个 cloud-proxy 能力用真实实装(isStub=false, status='stable')
 *   - 无 caller 时,3 个 cloud-proxy 能力走 stub(isStub=true, status='stub')
 * - 3 个 transformers-js 能力(ocr/caption/background-remove)仍为 stub
 *   (Phase 4 实装本地 AI 推理)
 *
 * 能力声明(AI_CAPABILITIES)由 codegen 从 manifests/ai.manifest.json 生成,
 * 见 packages/capability/src/presets/ai.generated.ts。本文件只负责 impl 绑定,
 * 因 AI 能力形态异构,buildAiCapabilityImplementations 为手写(不走通用 entries 驱动)。
 */

import {
  createBlobCapabilityImpl,
  defaultDeriveOutputMetadata,
} from '@lokvis/plugin-sdk';
import {
  transformersEngine,
  cloudProxyEngine,
  removeBackground as removeBackgroundOp,
  generateWorkflow as generateWorkflowStub,
  optimizeWorkflow as optimizeWorkflowStub,
  diagnoseError as diagnoseErrorStub,
  createGenerateWorkflowOperation,
  createOptimizeWorkflowOperation,
  createDiagnoseErrorOperation,
} from '@lokvis/engine-ai';
import type { AiCloudCaller } from '@lokvis/engine-ai';
// O-16:ocr / caption 返回结构化对象(Blob→OcrResult/CaptionResult),
// 已从主入口移至 `@lokvis/engine-ai/structured` 子路径
import {
  ocr as ocrOp,
  caption as captionOp,
} from '@lokvis/engine-ai/structured';
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

// ─── 引擎 stub 标识(AGENTS.md 约定:version.includes('stub')) ──
const transformersIsStub = transformersEngine.version.includes('stub');
// cloud-proxy:version 非 stub,但无 caller 注入时仍走 stub 路径
const cloudProxyIsStubWithoutCaller = cloudProxyEngine.version.includes('stub');

// ─── Blob 操作:ocr / caption / background-remove ──────────
// ocr / caption 的引擎返回结构化对象,桥接层提取 text 封装为 text/plain Blob。
// background-remove 是标准 Blob→Blob,直接透传。

const ocrOperation: SingleAiOperation = async (blob, params) => {
  const result = await ocrOp(blob, params);
  return new Blob([result.text], { type: 'text/plain' });
};

const captionOperation: SingleAiOperation = async (blob, params) => {
  const result = await captionOp(blob, params);
  return new Blob([result.text], { type: 'text/plain' });
};

const removeBackgroundOperation: SingleAiOperation = (blob, params) =>
  removeBackgroundOp(blob, params);

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

// ─── 自定义实现:generate-workflow / optimize-workflow / diagnose-error ──
// 这三个能力不接受 Asset 输入,不走 createBlobCapabilityImpl 工厂。

/**
 * ai.generate-workflow 实现:从 params.prompt 生成 workflow,
 * 输出为 data 类型 Asset(workflow JSON)。
 *
 * @param isStub 无 caller 时为 true(走 stub),有 caller 时为 false
 * @param operation 实际执行函数(stub 或 createGenerateWorkflowOperation)
 */
function createGenerateWorkflowImpl(
  isStub: boolean,
  operation: typeof generateWorkflowStub,
  ctx: PluginContext
): CapabilityImplementation {
  return {
    capability: 'ai.generate-workflow',
    engine: 'cloud-proxy',
    status: isStub ? 'stub' : 'stable',
    async execute(_inputs, params, execCtx) {
      execCtx.onProgress?.(0.1, 'Generating workflow');
      const workflow = await operation(params);
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
 * ai.optimize-workflow 实现:从 params.workflow 优化已有 workflow,
 * 输出为 data 类型 Asset(优化后的 workflow JSON)。
 */
function createOptimizeWorkflowImpl(
  isStub: boolean,
  operation: typeof optimizeWorkflowStub,
  ctx: PluginContext
): CapabilityImplementation {
  return {
    capability: 'ai.optimize-workflow',
    engine: 'cloud-proxy',
    status: isStub ? 'stub' : 'stable',
    async execute(_inputs, params, execCtx) {
      execCtx.onProgress?.(0.1, 'Optimizing workflow');
      const workflow = await operation(params);
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
 * ai.diagnose-error 实现(F1 新增):从 params.error 诊断执行错误,
 * 输出为 data 类型 Asset(诊断报告 JSON)。
 */
function createDiagnoseErrorImpl(
  isStub: boolean,
  operation: typeof diagnoseErrorStub,
  ctx: PluginContext
): CapabilityImplementation {
  return {
    capability: 'ai.diagnose-error',
    engine: 'cloud-proxy',
    status: isStub ? 'stub' : 'stable',
    async execute(_inputs, params, execCtx) {
      execCtx.onProgress?.(0.1, 'Diagnosing error');
      const report = await operation(params);
      const json = JSON.stringify(report, null, 2);
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
 * 构造所有 AI 能力的 CapabilityImplementation
 * (由 plugin.ts 在 installer 中调用)
 *
 * stub 标识按引擎 + caller 一次性计算:
 * - transformersIsStub:Phase 4 实装前为 true
 * - cloudProxyIsStub:无 caller 注入时为 true(走 stub),有 caller 时为 false
 *
 * 注:AI 能力形态异构(Blob→text / Blob→image / params→data),
 * 不走通用 entries 驱动,各实现手写绑定。
 *
 * @param ctx Plugin 上下文
 * @param cloudCaller 可选的 cloud-proxy 调用器(由 @lokvis/cloud-bridge 的
 *   CloudAiClient 实现)。无 caller 时 3 个 cloud-proxy 能力走 stub 路径。
 */
export function buildAiCapabilityImplementations(
  ctx: PluginContext,
  cloudCaller?: AiCloudCaller
): CapabilityImplementation[] {
  const cloudProxyIsStub = cloudProxyIsStubWithoutCaller || !cloudCaller;

  // cloud-proxy 操作:有 caller 用真实实装,无 caller 用 stub
  const generateWorkflowOp = cloudCaller
    ? createGenerateWorkflowOperation(cloudCaller)
    : generateWorkflowStub;
  const optimizeWorkflowOp = cloudCaller
    ? createOptimizeWorkflowOperation(cloudCaller)
    : optimizeWorkflowStub;
  const diagnoseErrorOp = cloudCaller
    ? createDiagnoseErrorOperation(cloudCaller)
    : diagnoseErrorStub;

  return [
    // ① ai.ocr — Blob→text(transformers-js,Phase 4 前为 stub)
    createBlobCapabilityImpl(
      {
        capability: 'ai.ocr',
        engine: 'transformers-js',
        outputType: 'text',
        operation: ocrOperation,
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
        operation: captionOperation,
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
        operation: removeBackgroundOperation,
        isStub: transformersIsStub,
        deriveMetadata: defaultDeriveOutputMetadata,
      },
      ctx
    ),
    // ④ ai.generate-workflow — params→data(无 Asset 输入)
    createGenerateWorkflowImpl(
      cloudProxyIsStub,
      generateWorkflowOp,
      ctx
    ),
    // ⑤ ai.optimize-workflow — params→data
    createOptimizeWorkflowImpl(
      cloudProxyIsStub,
      optimizeWorkflowOp,
      ctx
    ),
    // ⑥ ai.diagnose-error — params→data(F1 新增)
    createDiagnoseErrorImpl(cloudProxyIsStub, diagnoseErrorOp, ctx),
  ];
}

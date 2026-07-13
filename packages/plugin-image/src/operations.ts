/**
 * Image Capability 实现
 *
 * 通过 plugin-sdk 的 createBlobCapabilityImpl 工厂把 engine-image 的
 * Blob↔Blob 操作包装为 CapabilityImplementation:Asset[] + params → Asset[]
 *
 * 工厂封装了"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"
 * 五步样板,本文件只需提供 operation 函数与 isStub 检测。
 *
 * 能力声明(IMAGE_CAPABILITIES)由 codegen 从 manifests/image.manifest.json 生成,
 * 见 packages/capability/src/presets/image.generated.ts。本文件只负责 impl 绑定
 * (capability name → engine + operation)。
 */

import type { PluginContext } from '@lokvis/schema';
import type { CapabilityImplementation } from '@lokvis/schema';
import { createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import {
  canvasEngine,
  resize as opResize,
  compress as opCompress,
  convert as opConvert,
  crop as opCrop,
  rotate as opRotate,
  flip as opFlip,
  watermark as opWatermark,
  setBackground as opSetBackground,
  filter as opFilter,
} from '@lokvis/engine-image';

/** Capability 名 → 操作函数的映射类型 */
export type ImageOperation = (
  blob: Blob,
  params: Record<string, unknown>,
  signal?: AbortSignal
) => Promise<Blob>;

/** 图像能力实现绑定项(capability name → engine + operation) */
export interface ImageOperationEntry {
  /** 对应 Capability 名(与 generated 声明的 name 字段关联) */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 实际执行函数(Blob → Blob) */
  operation: ImageOperation;
}

// ─── 各操作的参数转换 + 调用 ───────────────────────────────
// engine-image 操作函数已接受 Record<string, unknown>，无需类型断言。

const resizeOp: ImageOperation = (blob, params, signal) => opResize(blob, params, signal);
const compressOp: ImageOperation = (blob, params, signal) => opCompress(blob, params, signal);
const convertOp: ImageOperation = (blob, params, signal) => opConvert(blob, params, signal);
const cropOp: ImageOperation = (blob, params, signal) => opCrop(blob, params, signal);
const rotateOp: ImageOperation = (blob, params, signal) => opRotate(blob, params, signal);
const flipOp: ImageOperation = (blob, params, signal) => opFlip(blob, params, signal);
const watermarkOp: ImageOperation = (blob, params, signal) => opWatermark(blob, params, signal);
const backgroundOp: ImageOperation = (blob, params, signal) => opSetBackground(blob, params, signal);
const filterOp: ImageOperation = (blob, params, signal) => opFilter(blob, params, signal);

/** 全部图像能力实现绑定(operation → engine 映射,能力声明由 generated 提供) */
export const IMAGE_OPERATION_ENTRIES: ImageOperationEntry[] = [
  { capability: 'image.resize',      engine: 'canvas', operation: resizeOp },
  { capability: 'image.compress',    engine: 'canvas', operation: compressOp },
  { capability: 'image.convert',     engine: 'canvas', operation: convertOp },
  { capability: 'image.crop',        engine: 'canvas', operation: cropOp },
  { capability: 'image.rotate',      engine: 'canvas', operation: rotateOp },
  { capability: 'image.flip',        engine: 'canvas', operation: flipOp },
  { capability: 'image.watermark',   engine: 'canvas', operation: watermarkOp },
  { capability: 'image.background',  engine: 'canvas', operation: backgroundOp },
  { capability: 'image.filter',      engine: 'canvas', operation: filterOp },
];

/** engine-image stub 检测(AGENTS.md 约定:version.includes('stub')) */
const isStub = canvasEngine.version.includes('stub');

/**
 * 构造所有图像能力的 CapabilityImplementation
 * (由 plugin.ts 在 installer 中调用)
 */
export function buildImageCapabilityImplementations(
  ctx: PluginContext
): CapabilityImplementation[] {
  return IMAGE_OPERATION_ENTRIES.map((entry) =>
    createBlobCapabilityImpl(
      {
        capability: entry.capability,
        engine: entry.engine,
        outputType: 'image',
        operation: entry.operation,
        isStub,
      },
      ctx
    )
  );
}

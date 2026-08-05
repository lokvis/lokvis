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
import type { BuiltinCapabilityName, CapabilityImplementation } from '@lokvis/schema';
import { createBlobCapabilityImpl, isStubEngine } from '@lokvis/plugin-sdk';
import type { BlobOperation } from '@lokvis/plugin-sdk';
import {
  IMAGE_ENGINE,
  resize as opResize,
  compress as opCompress,
  convert as opConvert,
  crop as opCrop,
  rotate as opRotate,
  flip as opFlip,
  watermark as opWatermark,
  setBackground as opSetBackground,
  filter as opFilter,
  encodeIco as opEncodeIco,
} from '@lokvis/engine-image';

/** Capability 名 → 操作函数的映射类型(FO-39:复用 plugin-sdk 通用类型) */
export type ImageOperation = BlobOperation;

/** 图像能力实现绑定项(capability name → engine + operation) */
export interface ImageOperationEntry {
  /** 对应 Capability 名(与 generated 声明的 name 字段关联) */
  capability: BuiltinCapabilityName;
  /** 引擎名 */
  engine: string;
  /** 实际执行函数(Blob → Blob) */
  operation: ImageOperation;
}

// ─── 各操作的参数转换 + 调用 ───────────────────────────────
// engine-image 操作函数已接受 Record<string, unknown>，无需类型断言。
// 直接引用 engine 导出,无需零增益透传包装。

/** 全部图像能力实现绑定(operation → engine 映射,能力声明由 generated 提供) */
export const IMAGE_OPERATION_ENTRIES: ImageOperationEntry[] = [
  { capability: 'image.resize',      engine: 'canvas', operation: opResize },
  { capability: 'image.compress',    engine: 'canvas', operation: opCompress },
  { capability: 'image.convert',     engine: 'canvas', operation: opConvert },
  { capability: 'image.crop',        engine: 'canvas', operation: opCrop },
  { capability: 'image.rotate',      engine: 'canvas', operation: opRotate },
  { capability: 'image.flip',        engine: 'canvas', operation: opFlip },
  { capability: 'image.watermark',   engine: 'canvas', operation: opWatermark },
  { capability: 'image.background',  engine: 'canvas', operation: opSetBackground },
  { capability: 'image.filter',      engine: 'canvas', operation: opFilter },
  { capability: 'image.favicon',     engine: 'canvas', operation: opEncodeIco },
];

/** engine-image stub 检测(AGENTS.md 约定:version.includes('stub')) */
const isStub = isStubEngine(IMAGE_ENGINE);

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

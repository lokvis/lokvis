/**
 * Plugin SDK 实现
 *
 * definePlugin / createCapabilityImpl / createBlobCapabilityImpl /
 * createMergeCapabilityImpl / createSplitCapabilityImpl / definePanel /
 * defaultDeriveOutputMetadata 的具体实现。
 *
 * 包级文档与 re-export 见 index.ts(barrel)。
 */

import type {
  Asset,
  AssetMetadata,
  AssetType,
  CapabilityImplementation,
  ExecutionContext,
  PluginConfig,
  PluginContext,
  PluginInstaller,
  PanelDefinition,
} from '@lokvis/schema';

/**
 * 定义一个 Lokvis Plugin
 *
 * @example
 * ```ts
 * export default definePlugin({
 *   name: 'lokvis-image-tools',
 *   version: '1.0.0',
 *   capabilities: [
 *     {
 *       name: 'image.resize',
 *       description: 'Resize image to specified dimensions',
 *       inputTypes: ['image'],
 *       outputTypes: ['image'],
 *       params: [
 *         { name: 'width', type: 'number', required: false },
 *         { name: 'height', type: 'number', required: false },
 *         { name: 'fit', type: 'enum', values: ['cover', 'contain', 'fill'] }
 *       ],
 *       performance: 'fast'
 *     }
 *   ],
 *   engine: 'squoosh'
 * });
 * ```
 */
export function definePlugin(
  config: PluginConfig,
  installer?: (ctx: PluginContext) => void | Promise<void>
): { config: PluginConfig; install: PluginInstaller } {
  return {
    config,
    install: async (ctx: PluginContext) => {
      // 注册能力声明（由 Runtime 在加载插件时调用）
      // 注意：能力实现的注册由 installer 完成
      if (installer) {
        await installer(ctx);
      }
    },
  };
}

/** 便捷工具：创建能力实现注册函数 */
export function createCapabilityImpl(
  capability: string,
  engine: string,
  execute: CapabilityImplementation['execute']
): CapabilityImplementation {
  // 显式设 status:'stable'(AGENTS.md stub 约定要求显式标注;
  // CapabilityRegistry.resolve() 依此判断是否跳过)。
  // 本工厂仅用于内联 builtin 实现(如 plugin-dev),不用于 stub 占位。
  return { capability, engine, status: 'stable', execute };
}

/** 便捷工具：创建 Panel 定义 */
export function definePanel(panel: PanelDefinition): PanelDefinition {
  return panel;
}

// ─── Blob 能力实现工厂 ──────────────────────────────────────

/**
 * 默认元数据派生:从 source Asset 传播 dimensions,从 outBlob 取 mimeType/size/format。
 * 适用于 image/video 等"变换不改变 dimensions 语义"的 Blob↔Blob 操作。
 */
export function defaultDeriveOutputMetadata(
  source: Asset,
  outBlob: Blob
): AssetMetadata {
  const mimeType = outBlob.type || source.metadata.mimeType;
  const format = mimeType.split('/')[1] ?? source.metadata.format;
  return {
    mimeType,
    size: outBlob.size,
    format,
    dimensions: source.metadata.dimensions,
  };
}

/** Blob 能力实现工厂选项 */
export interface BlobCapabilityOptions {
  /** 对应 Capability 名 */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数(Blob → Blob),signal 可选 */
  operation: (
    blob: Blob,
    params: Record<string, unknown>,
    signal?: AbortSignal
  ) => Promise<Blob>;
  /** 是否为 stub 实现(engine.version.includes('stub')) */
  isStub: boolean;
  /** 自定义元数据派生;默认用 defaultDeriveOutputMetadata */
  deriveMetadata?: (source: Asset, outBlob: Blob) => AssetMetadata;
}

/**
 * 创建单输入→单输出的 Blob 能力实现(长期方案:消除 plugin-* 重复)。
 *
 * 封装"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"
 * 五步样板。plugin-image / plugin-video / plugin-pdf(single kind)共享此工厂,
 * 各自只提供 operation 函数与 isStub 检测,不再重复 wrapAsImplementation。
 *
 * merge(N→1) / split(1→N) 形态不同,使用 createMergeCapabilityImpl /
 * createSplitCapabilityImpl 工厂。
 */
export function createBlobCapabilityImpl(
  options: BlobCapabilityOptions,
  ctx: PluginContext
): CapabilityImplementation {
  const { capability, engine, outputType, operation, isStub } = options;
  const deriveMetadata = options.deriveMetadata ?? defaultDeriveOutputMetadata;
  return {
    capability,
    engine,
    status: isStub ? 'stub' : 'stable',
    async execute(
      inputs: Asset[],
      params: Record<string, unknown>,
      execCtx: ExecutionContext
    ): Promise<Asset[]> {
      if (inputs.length === 0) {
        throw new Error(
          `Capability "${capability}" requires at least one input asset`
        );
      }
      const outputs: Asset[] = [];
      for (let i = 0; i < inputs.length; i++) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const asset = inputs[i]!;
        execCtx.onProgress?.(
          i / inputs.length,
          `Processing ${i + 1}/${inputs.length}`
        );
        const blob = await ctx.runtime.getAssetBlob(asset);
        const outBlob = await operation(blob, params, execCtx.signal);
        const metadata = deriveMetadata(asset, outBlob);
        const outAsset = await ctx.runtime.createAsset(
          outBlob,
          metadata,
          outputType
        );
        outputs.push(outAsset);
      }
      execCtx.onProgress?.(1, 'Done');
      return outputs;
    },
  };
}

/** Merge(N→1)能力实现工厂选项 */
export interface MergeCapabilityOptions {
  /** 对应 Capability 名 */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数(Blob[] → Blob) */
  operation: (
    blobs: Blob[],
    params: Record<string, unknown>
  ) => Promise<Blob>;
  /** 是否为 stub 实现(engine.version.includes('stub')) */
  isStub: boolean;
  /**
   * 自定义元数据派生;merge 无单一 source,签名是 (outBlob) => AssetMetadata。
   * 必填(无合理默认值,各 AssetType 默认 MIME 不同)。
   */
  deriveMetadata: (outBlob: Blob) => AssetMetadata;
}

/**
 * 创建多输入→单输出的 Merge 能力实现(N→1,如 pdf.merge)。
 *
 * 封装"逐个取 blob → 调 operation(blobs[]) → 派生 metadata → createAsset
 * → 进度/取消"五步样板。与 createBlobCapabilityImpl 共用语义,
 * 区别在 operation 接收 Blob[] 而非单 Blob,只产出 1 个 Asset。
 */
export function createMergeCapabilityImpl(
  options: MergeCapabilityOptions,
  ctx: PluginContext
): CapabilityImplementation {
  const { capability, engine, outputType, operation, isStub, deriveMetadata } =
    options;
  return {
    capability,
    engine,
    status: isStub ? 'stub' : 'stable',
    async execute(
      inputs: Asset[],
      params: Record<string, unknown>,
      execCtx: ExecutionContext
    ): Promise<Asset[]> {
      if (inputs.length === 0) {
        throw new Error(
          `Capability "${capability}" requires at least one input asset`
        );
      }
      const blobs: Blob[] = [];
      for (let i = 0; i < inputs.length; i++) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const asset = inputs[i]!;
        execCtx.onProgress?.(
          i / inputs.length,
          `Reading ${i + 1}/${inputs.length}`
        );
        blobs.push(await ctx.runtime.getAssetBlob(asset));
      }
      execCtx.onProgress?.(0.9, 'Merging');
      const outBlob = await operation(blobs, params);
      const outAsset = await ctx.runtime.createAsset(
        outBlob,
        deriveMetadata(outBlob),
        outputType
      );
      execCtx.onProgress?.(1, 'Done');
      return [outAsset];
    },
  };
}

/** Split(1→N)能力实现工厂选项 */
export interface SplitCapabilityOptions {
  /** 对应 Capability 名 */
  capability: string;
  /** 引擎名 */
  engine: string;
  /** 输出 Asset 类型 */
  outputType: AssetType;
  /** 实际执行函数(Blob → Blob[]) */
  operation: (
    blob: Blob,
    params: Record<string, unknown>
  ) => Promise<Blob[]>;
  /** 是否为 stub 实现(engine.version.includes('stub')) */
  isStub: boolean;
  /**
   * 自定义元数据派生;split 有多个 outBlob,签名是 (outBlob) => AssetMetadata,
   * 对每个 outBlob 调用一次。必填(无合理默认值)。
   */
  deriveMetadata: (outBlob: Blob) => AssetMetadata;
}

/**
 * 创建单输入→多输出的 Split 能力实现(1→N,如 pdf.split)。
 *
 * 封装"取 blob → 调 operation(blob) → 对每个 outBlob 派生 metadata +
 * createAsset → 进度/取消"五步样板。与 createBlobCapabilityImpl 共用语义,
 * 区别在 operation 返回 Blob[] 而非单 Blob,产生 N 个 Asset。
 */
export function createSplitCapabilityImpl(
  options: SplitCapabilityOptions,
  ctx: PluginContext
): CapabilityImplementation {
  const { capability, engine, outputType, operation, isStub, deriveMetadata } =
    options;
  return {
    capability,
    engine,
    status: isStub ? 'stub' : 'stable',
    async execute(
      inputs: Asset[],
      params: Record<string, unknown>,
      execCtx: ExecutionContext
    ): Promise<Asset[]> {
      if (inputs.length === 0) {
        throw new Error(
          `Capability "${capability}" requires at least one input asset`
        );
      }
      const outputs: Asset[] = [];
      for (let i = 0; i < inputs.length; i++) {
        if (execCtx.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const asset = inputs[i]!;
        execCtx.onProgress?.(
          i / inputs.length,
          `Processing ${i + 1}/${inputs.length}`
        );
        const blob = await ctx.runtime.getAssetBlob(asset);
        const outBlobs = await operation(blob, params);
        for (const outBlob of outBlobs) {
          outputs.push(
            await ctx.runtime.createAsset(
              outBlob,
              deriveMetadata(outBlob),
              outputType
            )
          );
        }
      }
      execCtx.onProgress?.(1, 'Done');
      return outputs;
    },
  };
}

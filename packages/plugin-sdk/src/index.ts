/**
 * @lokvis/plugin-sdk
 *
 * Plugin 开发 SDK。Plugin 只能看到 Runtime API，看不到 React/Redux/Cloud。
 * 通过 definePlugin 定义插件，安装时通过 PluginContext 注册能力。
 *
 * 定位(见 docs/AI生态冲击调整方案.md §4):
 * - 角色:浏览器内嵌入场景的兼容层,不再是生态核心
 * - 优先级:Alpha 预览(0.1.0-alpha),不发布 v1.0
 * - 替代方案:若想让 AI 调用你的能力,推荐使用 @lokvis/mcp-server(MCP 标准)
 *
 * 适用场景:
 * 1. 用 @lokvis/sdk 嵌入 Lokvis 到自己网站,需自定义能力 → Plugin SDK
 * 2. 让 Claude/ChatGPT/Cursor 调用本地能力 → MCP server(推荐)
 *
 * 维持现状的 API:definePlugin / createCapabilityImpl / definePanel 不变。
 */

import type {
  Asset,
  AssetMetadata,
  AssetType,
  Capability,
  CapabilityImplementation,
  ExecutionContext,
  PluginConfig,
  PluginContext,
  PluginInstaller,
  PluginPermission,
  PanelDefinition,
} from '@lokvis/schema';

export type {
  Asset,
  AssetMetadata,
  AssetType,
  Capability,
  CapabilityImplementation,
  ExecutionContext,
  PluginConfig,
  PluginContext,
  PluginInstaller,
  PluginPermission,
  PanelDefinition,
};

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
  return { capability, engine, execute };
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
 * merge(N→1) / split(1→N) 形态不同,仍由 plugin-pdf 自行实现。
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

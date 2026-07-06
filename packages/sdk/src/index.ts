/**
 * @lokvis/sdk
 *
 * Lokvis SDK - 在任意 Web 应用中嵌入 Lokvis Runtime。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 *
 * const lokvis = await createLokvis();
 *
 * // 运行工作流
 * const assetId = await lokvis.importAsset({ kind: 'file', file });
 * const result = await lokvis.run(workflow, [assetId]);
 * ```
 */

import type { LokvisRuntime } from '@lokvis/runtime';
import type { RuntimeConfig } from '@lokvis/runtime';
import type { PluginConfig, PluginInstaller } from '@lokvis/plugin-sdk';
import { createRuntime } from '@lokvis/runtime';
import { PluginLoadError } from './errors.js';

/** 插件加载项 */
export interface PluginLoadEntry {
  config: PluginConfig;
  install: PluginInstaller;
}

/** createLokvis 配置 */
export interface CreateLokvisOptions extends RuntimeConfig {
  /** 预加载的插件列表 */
  plugins?: PluginLoadEntry[];
}

/**
 * 安装单个插件到 Runtime(共享逻辑)。
 *
 * 委托给 `runtime.installPlugin(plugin)` —— Runtime 公共接口承担:
 * 注册能力声明 → 构造 PluginContext → 调用 plugin.install → 发射 plugin:loaded。
 * SDK 只负责把 plugin.install 抛出的错误包成 PluginLoadError,
 * 不再通过 `instanceof LokvisRuntimeImpl` + `_getAssetStore()` 反向访问内部依赖。
 *
 * 由 createLokvis(批量预加载)与 loadPlugin(运行时单个加载)复用,避免重复实现。
 */
async function installPlugin(
  runtime: LokvisRuntime,
  plugin: PluginLoadEntry
): Promise<void> {
  try {
    await runtime.installPlugin(plugin);
  } catch (err) {
    // runtime.installPlugin 已发射 plugin:loaded 之前抛错时,SDK 包成 PluginLoadError
    // (若错误本身就是 PluginLoadError 则原样上抛,避免双重包装)
    if (err instanceof PluginLoadError) throw err;
    throw new PluginLoadError(
      plugin.config.name,
      `Plugin "${plugin.config.name}" install failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}

/**
 * 创建 Lokvis Runtime 实例。
 *
 * 初始化 Runtime(OPFS/IndexedDB 资产存储、能力注册表、事件总线、Worker 隔离),
 * 并按 `options.plugins` 顺序预加载插件。返回的 `LokvisRuntime` 实例是所有
 * 后续操作的入口(importAsset / run / capabilities / eventBus ...)。
 *
 * @example
 * ```ts
 * const lokvis = await createLokvis({
 *   plugins: [imageToolsPlugin()],
 *   storageQuota: 1024 * 1024 * 1024, // 1GB
 * });
 * ```
 *
 * @public
 */
export async function createLokvis(
  options: CreateLokvisOptions = {}
): Promise<LokvisRuntime> {
  const { plugins = [], ...runtimeConfig } = options;
  const runtime = await createRuntime(runtimeConfig);

  // 预加载插件(委托 runtime.installPlugin,无需 instanceof 具体类)
  for (const plugin of plugins) {
    await installPlugin(runtime, plugin);
  }

  return runtime;
}

/**
 * 加载单个插件到已有 Runtime。
 *
 * 用于运行时动态扩展能力(如用户在 UI 中启用某插件)。与 `createLokvis`
 * 的 `plugins` 选项复用同一安装路径,区别仅在时机。
 *
 * @public
 */
export async function loadPlugin(
  runtime: LokvisRuntime,
  plugin: PluginLoadEntry
): Promise<void> {
  await installPlugin(runtime, plugin);
}

// ─── 公共类型 re-export ──────────────────────────────────────────

/** @public */
export type { LokvisRuntime, RuntimeConfig } from '@lokvis/runtime';
/** @public */
export type { PluginConfig, PluginContext } from '@lokvis/plugin-sdk';
/**
 * @public
 *
 * MCP manifest 类型(见 docs/AI生态冲击调整方案.md §6.1)
 */
export type {
  Asset,
  AssetId,
  Workflow,
  WorkflowResult,
  Capability,
  McpManifest,
  McpToolManifest,
  McpResourceManifest,
  WorkflowAiInstruction,
} from '@lokvis/schema';
/** @public */
export { workflowToAiInstruction } from '@lokvis/schema';

// ─── 错误类型体系(W4.2)──────────────────────────────────────────
export {
  LokvisError,
  type LokvisErrorCode,
  type LokvisErrorOptions,
  AssetNotFoundError,
  AssetImportError,
  AssetExportError,
  WorkflowInvalidError,
  WorkflowCycleError,
  WorkflowNodeError,
  CapabilityNotRegisteredError,
  CapabilityStubOnlyError,
  StorageQuotaExceededError,
  StorageOpfsUnavailableError,
  StorageIdbUnavailableError,
  WorkerCrashedError,
  WorkerTimeoutError,
  WorkerDeadError,
  WorkerRequestAbortedError,
  WorkerHandshakeError,
  DegradationRejectedError,
  PluginLoadError,
  fromLokvisError,
} from './errors.js';

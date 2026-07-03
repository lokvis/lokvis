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
import type { AssetStore, CapabilityRegistry } from '@lokvis/runtime';
import type { EventBus } from '@lokvis/schema';
import type { PluginConfig, PluginContext, PluginInstaller } from '@lokvis/plugin-sdk';
import { createRuntime, LokvisRuntimeImpl } from '@lokvis/runtime';
import { AssetNotFoundError, PluginLoadError } from './errors.js';

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
 * 安装单个插件到 Runtime 的依赖项上(共享逻辑)。
 * 步骤:注册能力声明 → 构造受限 PluginContext → 调用 plugin.install → 发射 plugin:loaded。
 * 由 createLokvis(批量预加载)与 loadPlugin(运行时单个加载)复用,避免重复实现。
 */
async function installPlugin(
  plugin: PluginLoadEntry,
  assetStore: AssetStore,
  capabilityRegistry: CapabilityRegistry,
  eventBus: EventBus
): Promise<void> {
  for (const capability of plugin.config.capabilities) {
    capabilityRegistry.registerCapability(capability);
  }
  const ctx = createPluginContext(plugin.config.name, assetStore, capabilityRegistry, eventBus);
  try {
    await plugin.install(ctx);
  } catch (err) {
    throw new PluginLoadError(
      plugin.config.name,
      `Plugin "${plugin.config.name}" install failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
  eventBus.emit({
    type: 'plugin:loaded',
    name: plugin.config.name,
    version: plugin.config.version,
  });
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

  // 预加载插件(复用 installPlugin,避免与 loadPlugin 重复实现)
  if (plugins.length > 0) {
    if (runtime instanceof LokvisRuntimeImpl) {
      const assetStore = runtime._getAssetStore();
      const capabilityRegistry = runtime._getCapabilityRegistry();
      const eventBus = runtime.eventBus;
      for (const plugin of plugins) {
        await installPlugin(plugin, assetStore, capabilityRegistry, eventBus);
      }
    } else {
      // 非 LokvisRuntimeImpl(如测试 mock / 自定义实现):跳过插件加载但给出明确警告,
      // 避免用户困惑"为何插件没生效"。调用方若需在自定义 runtime 上加载插件,
      // 应直接使用 loadPlugin 并自行确保 runtime 暴露所需内部 API。
      console.warn(
        '[lokvis/sdk] createLokvis: runtime is not LokvisRuntimeImpl, ' +
          `${plugins.length} plugin(s) skipped. Use loadPlugin() manually if needed.`
      );
    }
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
  if (!(runtime instanceof LokvisRuntimeImpl)) {
    throw new PluginLoadError(
      plugin.config.name,
      'Plugin loading requires a LokvisRuntimeImpl instance'
    );
  }

  await installPlugin(
    plugin,
    runtime._getAssetStore(),
    runtime._getCapabilityRegistry(),
    runtime.eventBus
  );
}

/**
 * 构造 PluginContext
 *
 * Plugin 只看到受限的 Runtime API：
 * - getAsset / importAsset / getAssetBlob / createAsset / listCapabilities
 * - 看不到 React / Redux / Cloud
 */
function createPluginContext(
  pluginName: string,
  assetStore: AssetStore,
  capabilityRegistry: CapabilityRegistry,
  eventBus: EventBus
): PluginContext {
  return {
    runtime: {
      getAsset: async (id) => {
        const asset = await assetStore.get(id);
        if (!asset) throw new AssetNotFoundError(id);
        return asset;
      },
      importAsset: async (file) => {
        // PluginContext.importAsset 接受 File | Blob，统一转为 AssetSource
        if (file instanceof File) {
          const asset = await assetStore.import({ kind: 'file', file });
          return asset.id;
        }
        const asset = await assetStore.import({ kind: 'blob', blob: file, name: `blob_${Date.now()}` });
        return asset.id;
      },
      getAssetBlob: (asset) => assetStore.getBlob(asset.blob),
      createAsset: (blob, metadata, type) => assetStore.create(blob, metadata, type),
      listCapabilities: async () => capabilityRegistry.list(),
    },
    eventBus,
    registerCapability: (impl) => capabilityRegistry.registerImplementation(impl),
    registerPanel: (panel) => {
      // Panel 注册由 UI 层处理，这里仅记录日志
      void panel;
    },
    log: (level, message) => {
      const prefix = `[${pluginName}]`;
      if (level === 'error') console.error(`${prefix} ${message}`);
      else if (level === 'warn') console.warn(`${prefix} ${message}`);
      else console.log(`${prefix} ${message}`);
    },
  };
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

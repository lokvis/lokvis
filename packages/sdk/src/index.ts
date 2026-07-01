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
  await plugin.install(ctx);
  eventBus.emit({
    type: 'plugin:loaded',
    name: plugin.config.name,
    version: plugin.config.version,
  });
}

/** 创建 Lokvis Runtime 实例 */
export async function createLokvis(
  options: CreateLokvisOptions = {}
): Promise<LokvisRuntime> {
  const { plugins = [], ...runtimeConfig } = options;
  const runtime = await createRuntime(runtimeConfig);

  // 预加载插件(复用 installPlugin,避免与 loadPlugin 重复实现)
  if (plugins.length > 0 && runtime instanceof LokvisRuntimeImpl) {
    const assetStore = runtime._getAssetStore();
    const capabilityRegistry = runtime._getCapabilityRegistry();
    const eventBus = runtime.eventBus;
    for (const plugin of plugins) {
      await installPlugin(plugin, assetStore, capabilityRegistry, eventBus);
    }
  }

  return runtime;
}

/** 加载单个插件到已有 Runtime */
export async function loadPlugin(
  runtime: LokvisRuntime,
  plugin: PluginLoadEntry
): Promise<void> {
  if (!(runtime instanceof LokvisRuntimeImpl)) {
    throw new Error('Plugin loading requires a LokvisRuntimeImpl instance');
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
        if (!asset) throw new Error(`Asset not found: ${id}`);
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

export type { LokvisRuntime, RuntimeConfig } from '@lokvis/runtime';
export type { PluginConfig, PluginContext } from '@lokvis/plugin-sdk';
export type {
  Asset,
  AssetId,
  Workflow,
  WorkflowResult,
  Capability,
} from '@lokvis/schema';

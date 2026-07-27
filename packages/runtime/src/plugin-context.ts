/**
 * Plugin Context Factory(W1.6 从 runtime.ts 抽取)
 *
 * 构造受限 PluginContext,供 Runtime.installPlugin() 使用。Plugin 只看到
 * 受限 Runtime API(getAsset/importAsset/getAssetBlob/createAsset/
 * listCapabilities + eventBus + 注册器 + log),看不到 React/Redux/Cloud。
 *
 * registerMetadataReader / registerPanel 转发给 runtime._registerMetadataReader /
 * _registerPanel(依赖反转:Plugin 提供定义,Runtime 持有引用,UI 层消费)。
 *
 * 错误契约:getAsset 在资产不存在时抛 AssetNotFoundError,
 * SDK 的 fromLokvisError 经 instanceof 转换。
 */

import type {
  EventBus, MetadataReader, PanelDefinition, PluginContext,
  PluginPermissionSandbox as IPluginPermissionSandbox,
} from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';
import type { CapabilityRegistry } from './capability-registry.js';
import { AssetNotFoundError } from './errors.js';

/**
 * createPluginContext 需要从 Runtime 拿到的最小依赖。
 * 避免直接依赖 LokvisRuntimeImpl(循环引用)。
 */
export interface PluginContextRuntimeDeps {
  eventBus: EventBus;
  assetStore: AssetStore;
  capabilityRegistry: CapabilityRegistry;
  registerMetadataReader(name: string, reader: MetadataReader): void;
  /**
   * Panel 注册回调(依赖反转)。由 runtime._registerPanel 实现:
   * 持有 PanelDefinition 并发射 panel:registered 事件,UI 层消费。
   */
  registerPanel(panel: PanelDefinition): void;
  /**
   * 权限沙箱(W18.6)。由 runtime 构造并注入(基于 plugin.config.permissions),
   * 用于在 PluginContext 上暴露 ctx.sandbox,并在 installPlugin() 期间应用
   * network guard。
   */
  sandbox: IPluginPermissionSandbox;
}

/** 构造受限 PluginContext(供 Runtime.installPlugin 调用)。 */
export function createPluginContext(
  pluginName: string,
  deps: PluginContextRuntimeDeps
): PluginContext {
  const { assetStore, capabilityRegistry } = deps;
  return {
    runtime: {
      getAsset: async (id) => {
        const asset = await assetStore.get(id);
        if (!asset) throw new AssetNotFoundError(id);
        return asset;
      },
      importAsset: async (file) => {
        // PluginContext.importAsset 接受 File | Blob,统一转为 AssetSource
        if (file instanceof File) {
          const asset = await assetStore.import({ kind: 'file', file });
          return asset.id;
        }
        const asset = await assetStore.import({
          kind: 'blob', blob: file, name: `blob_${Date.now()}`,
        });
        return asset.id;
      },
      getAssetBlob: (asset) => assetStore.getBlob(asset.blob),
      createAsset: (blob, metadata, type) =>
        assetStore.create(blob, metadata, type),
      listCapabilities: async () => capabilityRegistry.list(),
    },
    eventBus: deps.eventBus,
    registerCapability: (impl) =>
      capabilityRegistry.registerImplementation(impl),
    registerMetadataReader: <T>(name: string, reader: MetadataReader<T>) => {
      deps.registerMetadataReader(name, reader as MetadataReader);
    },
    registerPanel: (panel: PanelDefinition) => {
      deps.registerPanel(panel);
    },
    sandbox: deps.sandbox,
    log: (level, message) => {
      const prefix = `[${pluginName}]`;
      if (level === 'error') console.error(`${prefix} ${message}`);
      else if (level === 'warn') console.warn(`${prefix} ${message}`);
      else console.log(`${prefix} ${message}`);
    },
  };
}

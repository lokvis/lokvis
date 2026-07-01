/**
 * Lokvis Plugin Schema
 *
 * Plugin 是能力的载体。Plugin 通过 PluginContext 注册 Capability 到 Runtime。
 */

import type { Capability, CapabilityImplementation } from './capability.js';

/** Plugin 权限声明 */
export type PluginPermission =
  | 'asset:read'
  | 'asset:write'
  | 'network:none'
  | 'network:limited'
  | 'network:full'
  | 'filesystem:opfs'
  | 'filesystem:local';

/** Plugin Manifest（package.json 中的 lokvis 字段或独立 manifest.json） */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  icon?: string;
  /** 声明使用的能力 */
  capabilities: string[];
  /** 兼容的 Runtime 版本 */
  engines: {
    'lokvis-runtime': string;
  };
  /** 权限声明 */
  permissions: PluginPermission[];
}

/** Plugin 配置（definePlugin 的参数） */
export interface PluginConfig {
  name: string;
  version: string;
  description?: string;
  /** 声明能力（Capability 定义） */
  capabilities: Capability[];
  /** 使用的引擎名 */
  engine?: string;
  /** 权限声明 */
  permissions?: PluginPermission[];
}

/** Panel 定义（UI 扩展点） */
export interface PanelDefinition {
  id: string;
  name: string;
  /** Panel 位置 */
  location: 'sidebar' | 'inspector' | 'toolbar' | 'modal';
  /** 渲染组件标识（由 UI 层解析） */
  component: string;
  /** 显示条件 */
  show?: (context: { selectedAssets: string[] }) => boolean;
}

/**
 * Plugin 上下文（Plugin 能访问的全部 API）
 *
 * Plugin 只能看到受限的 Runtime API，看不到 React/Redux/Cloud。
 * 通过 runtime 读写 Asset，通过 registerCapability 注册能力实现。
 *
 * 注意:Plugin SDK 已定位为浏览器内嵌入的兼容层(见
 * docs/AI生态冲击调整方案.md §4)。若目标是让 AI 客户端调用本地能力,
 * 推荐使用 @lokvis/mcp-server(MCP 标准),而非 Plugin SDK。
 */
export interface PluginContext {
  /** Runtime 受限 API */
  runtime: {
    /** 获取资产元数据 */
    getAsset: (id: string) => Promise<import('./asset.js').Asset>;
    /** 导入文件为资产，返回 AssetId */
    importAsset: (file: File | Blob) => Promise<string>;
    /** 读取资产的实际 Blob 数据（用于处理） */
    getAssetBlob: (asset: import('./asset.js').Asset) => Promise<Blob>;
    /** 从 Blob 创建新资产（能力产出物） */
    createAsset: (
      blob: Blob,
      metadata: import('./asset.js').AssetMetadata,
      type: import('./asset.js').AssetType
    ) => Promise<import('./asset.js').Asset>;
    /** 列出所有已注册能力 */
    listCapabilities: () => Promise<import('./capability.js').Capability[]>;
  };
  /** 事件总线 */
  eventBus: import('./event.js').EventBus;
  /** 注册能力实现 */
  registerCapability(impl: CapabilityImplementation): void;
  /** 注册 UI Panel */
  registerPanel(panel: PanelDefinition): void;
  /** 日志 */
  log(level: 'info' | 'warn' | 'error', message: string): void;
}

/** definePlugin 返回的安装函数 */
export type PluginInstaller = (ctx: PluginContext) => void | Promise<void>;

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
 * 元数据读取函数(依赖反转)。
 *
 * 某些 Plugin 能力本质是"元数据查询"而非"资产变换"(如 EXIF 读取:
 * Blob → ExifData),既不符合 Engine 层 Blob↔Blob 约束,也不符合
 * CapabilityImplementation 的 Asset[]→Asset[] 契约。这类能力通过
 * MetadataReader 注册:Plugin 提供读取函数,Runtime 持有引用并按名调用。
 *
 * 与 registerCapability 的区别:
 * - registerCapability:注册变换能力(Asset→Asset),走 WorkflowExecutor
 * - registerMetadataReader:注册查询函数(Asset→T),走 Runtime 直接调用
 *
 * 优点(相对 Capability execute + data Asset 序列化方案):
 * - 无需创建临时 data Asset(避免手动 removeAsset 清理 / 泄漏)
 * - 无 JSON marshal/unmarshal 开销
 * - 类型直接透传(ExifData),无需序列化
 *
 * @param asset 输入资产
 * @returns 读取结果;无数据 / 解析失败返回 null
 */
export type MetadataReader<T = unknown> = (
  asset: import('./asset.js').Asset
) => Promise<T | null>;

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
  /** 注册能力实现(变换:Asset→Asset) */
  registerCapability(impl: CapabilityImplementation): void;
  /**
   * 注册元数据读取函数(查询:Asset→T)。
   *
   * 用于非变换类能力(如 EXIF 读取)。Runtime 持有 reader 引用,
   * UI 通过 runtime.readAssetExif(id) 间接调用,不直接依赖 Plugin / Engine。
   * 同名 reader 重复注册时覆盖前者(支持热更新)。
   *
   * @param name 读取器名称,约定与能力名对齐(如 'image.read-exif')
   * @param reader 读取函数
   */
  registerMetadataReader<T>(name: string, reader: MetadataReader<T>): void;
  /** 注册 UI Panel */
  registerPanel(panel: PanelDefinition): void;
  /** 日志 */
  log(level: 'info' | 'warn' | 'error', message: string): void;
}

/** definePlugin 返回的安装函数 */
export type PluginInstaller = (ctx: PluginContext) => void | Promise<void>;

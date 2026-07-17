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

/**
 * Plugin 权限沙箱契约(由 runtime 实现)。
 *
 * Plugin 通过 `ctx.sandbox` 访问自身权限声明,在调用受限 API 前主动断言:
 *   ctx.sandbox.assertNetworkAllowed('loading model manifest');
 * 若声明 network:none,断言立即抛 PluginPermissionError;否则 no-op。
 *
 * 实现见 @lokvis/runtime 的 PluginPermissionSandbox 类。schema 仅定义契约
 * (依赖反转:runtime 依赖 schema,而非反之)。
 */
export interface PluginPermissionSandbox {
  /** 插件名(便于错误信息定位) */
  readonly pluginName: string;
  /** 声明的权限集合(只读) */
  readonly declared: ReadonlySet<PluginPermission>;
  /** 是否声明了指定权限 */
  has(perm: PluginPermission): boolean;
  /**
   * 断言网络调用允许(声明 network:none 时抛错)。
   * Plugin 在调用 fetch / XHR 等前可主动调用。
   */
  assertNetworkAllowed(reason: string): void;
  /**
   * 断言文件系统访问允许(声明未含对应 filesystem:* 时抛错)。
   * @param scope 'opfs'(OPFS 根目录)或 'local'(任意本地文件系统)
   */
  assertFilesystemAllowed(scope: 'opfs' | 'local', reason: string): void;
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
 * Blob → ExifData),既不符合 Engine 层 Blob↔Blob 纯函数约束,也不符合
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
 * @param ctx 读取上下文(提供 log 可观测信号;TD-3.4 长期方案)
 * @returns 读取结果;无数据 / 解析失败返回 null
 */
export type MetadataReader<T = unknown> = (
  asset: import('./asset.js').Asset,
  ctx: MetadataReaderContext
) => Promise<T | null>;

/**
 * 元数据读取上下文(TD-3.4 长期方案)。
 *
 * 为 MetadataReader 提供可观测信号,使其能区分"无数据"(返回 null)
 * 与"解析异常"(log warn 后返回 null),避免静默吞错。
 *
 * 与 ExecutionContext 的关系:
 * - ExecutionContext 用于 Capability execute,含 workflowId / nodeId /
 *   signal / onProgress(走 WorkflowExecutor)
 * - MetadataReaderContext 用于 MetadataReader,只含 log(走 Runtime
 *   直接调用,无 workflow 上下文)
 *
 * log 签名与 ExecutionContext.log 一致,便于 Plugin 复用日志逻辑。
 */
export interface MetadataReaderContext {
  /** 日志函数(与 ExecutionContext.log 一致签名) */
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
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
  /**
   * 权限沙箱(W18.6)。
   *
   * Plugin 据此在调用受限 API 前主动断言:
   *   ctx.sandbox.assertNetworkAllowed('loading manifest');
   *
   * Runtime 在 installPlugin() 期间应用 network guard
   * (monkey-patch fetch/XHR/WebSocket/EventSource),声明
   * network:none 时这些 API 调用立即抛 NetworkGuardError。
   * capability execute() 路径不自动应用守卫 —— plugin 应主动自检。
   */
  readonly sandbox: PluginPermissionSandbox;
  /** 日志 */
  log(level: 'info' | 'warn' | 'error', message: string): void;
}

/** definePlugin 返回的安装函数 */
export type PluginInstaller = (ctx: PluginContext) => void | Promise<void>;

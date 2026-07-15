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

/**
 * Cloud 注入的认证信息(W17.3)。
 *
 * 由 cloud 侧(`apps/web` 或同构 SDK 容器)在用户完成登录后取得,
 * 透传给 `createLokvis({ auth })`。SDK 仅据 presence 推导 `isPro`,
 * 不校验 token 合法性 —— 校验由 cloud 网关完成,本地无 secret。
 *
 * - `session`:opaque cloud session 字符串(如 JWT),来自 lokvis-cloud 登录回包
 * - `token`:直接 API token(替代 session,用于 CLI / 后端调用场景)
 * - `isPro`:显式覆盖。不传时,若 `session` 或 `token` 非空则视为 Pro
 *
 * @public
 */
export interface LokvisAuthSession {
  /** Cloud 会话令牌(由 lokvis-cloud 登录后下发) */
  session?: string;
  /** API token(替代 session,用于无会话语境) */
  token?: string;
  /**
   * 显式声明 Pro 状态。优先级高于 session/token presence 推导。
   * 用于:cloud 已确认身份但游客身份 / 已订阅但 token 待续签 等场景。
   */
  isPro?: boolean;
}

/** createLokvis 配置 */
export interface CreateLokvisOptions extends RuntimeConfig {
  /** 预加载的插件列表 */
  plugins?: PluginLoadEntry[];
  /**
   * Cloud 注入的认证信息(W17.3)。
   *
   * - 传入非空 `session` 或 `token` 且未显式 `isPro: false` 时,
   *   `runtime.isPro` 自动置为 `true`(批量/槽位无上限)
   * - 不传 `auth`:保持 free 模式(`isPro = false`)
   *
   * SDK 仅做 presence 推导,不做 token 校验(校验由 cloud 网关完成)。
   */
  auth?: LokvisAuthSession;
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
 * 根据 `auth` 推导 `isPro`(W17.3)。
 *
 * 规则:
 * 1. 未传 `auth`:保持 free(`isPro = false`)
 * 2. `auth.isPro` 显式定义:以其为准(允许 cloud 标记游客 session)
 * 3. 否则:`session` 或 `token` 非空 → `isPro = true`
 *
 * 不做 token 形态/签名校验 —— cloud 网关负责鉴权,SDK 只接收结果。
 */
function resolveIsPro(auth: LokvisAuthSession | undefined): boolean {
  if (!auth) return false;
  if (auth.isPro !== undefined) return auth.isPro;
  return Boolean(auth.session || auth.token);
}

/**
 * 创建 Lokvis Runtime 实例。
 *
 * 初始化 Runtime(OPFS/IndexedDB 资产存储、能力注册表、事件总线、Worker 隔离),
 * 并按 `options.plugins` 顺序预加载插件。返回的 `LokvisRuntime` 实例是所有
 * 后续操作的入口(importAsset / run / capabilities / eventBus ...)。
 *
 * 当传入 `auth` 时,SDK 据 presence 推导 `isPro` 并传给 Runtime
 * (批量上限/槽位由 RuntimeConfig.isPro 控制,见 W17.4)。
 *
 * @example
 * ```ts
 * const lokvis = await createLokvis({
 *   plugins: [imageToolsPlugin()],
 *   storageQuota: 1024 * 1024 * 1024, // 1GB
 * });
 * ```
 *
 * @example 接 cloud session
 * ```ts
 * const lokvis = await createLokvis({
 *   auth: { session: cloudJwt }, // → isPro: true,批量/槽位无上限
 * });
 * ```
 *
 * @public
 */
export async function createLokvis(
  options: CreateLokvisOptions = {}
): Promise<LokvisRuntime> {
  const { plugins = [], auth, ...runtimeConfig } = options;

  // W17.3:据 auth 推导 isPro,与 RuntimeConfig.isPro 取或
  // (cloud 显式 auth.isPro 优先;否则若 session/token 存在则置 true)
  if (resolveIsPro(auth)) {
    runtimeConfig.isPro = true;
  }

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

/**
 * @public
 *
 * Runtime 类型(LokvisRuntime / RuntimeConfig 是核心入口;RunOptions /
 * ToMcpManifestOptions / RuntimeStatus 用于调用 runtime.run() /
 * runtime.toMcpManifest() / 读取 runtime.status;BatchProcessor 等用于
 * runtime.batch 的批量类型)。
 */
export type {
  LokvisRuntime,
  RuntimeConfig,
  RuntimeStatus,
  RunOptions,
  ToMcpManifestOptions,
  BatchProcessor,
  BatchJob,
  BatchItem,
  BatchItemInput,
  EnqueueOptions,
  BatchProgress,
} from '@lokvis/runtime';

/** @public */
export type { PluginConfig, PluginContext, PluginInstaller } from '@lokvis/plugin-sdk';

/**
 * @public
 *
 * Schema 公共类型:Asset / Workflow / Capability / EventBus / MCP manifest。
 * 包含 AssetSource(构造 importAsset 参数)、HistoryEntry(history() 返回)、
 * ExifData(readAssetExif() 返回)等调用 LokvisRuntime 方法时必须引用的类型。
 */
export type {
  Asset,
  AssetId,
  AssetSource,
  AssetType,
  AssetMetadata,
  HistoryEntry,
  ExifData,
  Workflow,
  WorkflowResult,
  Capability,
  EngineSelectionStrategy,
  EventBus,
  LokvisEvent,
  LokvisEventType,
  EventHandler,
  BatchItemStatus,
  BatchJobStatus,
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

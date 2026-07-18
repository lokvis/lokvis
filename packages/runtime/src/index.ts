/**
 * @lokvis/runtime
 *
 * Lokvis Runtime - Browser-local workflow execution engine.
 * 所有核心工作流在浏览器执行，Cloudflare 只承担边缘服务。
 *
 * 公共 API 收敛策略(O-3):
 * - 4 个模块全量透传:types / errors / browser-detect / runtime(仅 4 个符号)
 * - 7 个模块仅命名导出被外部消费的符号(AssetStore / 错误类 / BatchProcessor 等)
 * - 8 个纯内部模块(event-bus / capability-registry / executor / worker-protocol /
 *   history / memory-guard / plugin-permissions / plugin-context)不从公共入口透传,
 *   runtime 内部代码与测试通过相对路径 import。
 */

// ─── 全量透传(公共 API) ──────────────────────────────────────────
export * from './types.js';
export * from './errors.js';
export * from './browser-detect.js';
export * from './runtime.js';

// ─── 命名导出(仅被外部消费的符号) ────────────────────────────────

// asset-store:mcp-server 的 NodeAssetStore 实现此接口
export type { AssetStore } from './asset-store.js';

// opfs-asset-store:仅错误类被 SDK errors 引用
export { OpfsUnavailableError } from './opfs-asset-store.js';

// idb-asset-store:仅错误类被 SDK errors 引用
export { IdbUnavailableError } from './idb-asset-store.js';

// degradation:仅错误类被 SDK errors 引用
export { DegradationRejectedError } from './degradation.js';

// worker-host:6 个错误类被 SDK errors 引用
export {
  WorkerCrashedError,
  WorkerRestartingError,
  WorkerDeadError,
  WorkerRequestTimeoutError,
  WorkerHandshakeError,
  WorkerRequestAbortedError,
} from './worker-host.js';

// batch-processor:BatchProcessor 类型 + 错误类 + 常量被 SDK 引用
export {
  BatchProcessor,
  BatchLimitExceededError,
  FREE_BATCH_LIMIT,
} from './batch-processor.js';
export type {
  BatchJob,
  BatchItem,
  BatchItemInput,
  EnqueueOptions,
  BatchProgress,
} from './batch-processor.js';

// history-store:HistoryStore / HistoryStoreOptions 是 RuntimeConfig 字段类型契约
export type { HistoryStore, HistoryStoreOptions } from './history-store.js';

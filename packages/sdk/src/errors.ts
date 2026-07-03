/**
 * Lokvis SDK 错误类型体系(W4.2)
 *
 * 目标:给 SDK 消费者一个稳定的错误处理契约。Runtime 内部抛的各种
 * Error 子类(QuotaExceededError / DegradationRejectedError / Worker*Error)
 * 散落在多个模块,SDK 层用统一的 `LokvisError` 基类 + `code` 字段归一,
 * 让上层 `catch (e) { if (e instanceof LokvisError) ... }` 一处判定即可。
 *
 * 设计取舍:
 * - `code` 是稳定的字符串枚举(SDK 公共契约),不应随实现重构而变;
 *   `name` / class 名可能调整,但 `code` 不变 —— 便于日志聚合与分支处理。
 * - 不把 runtime 已有的 error class 全部改名(避免破坏现有测试与调用点),
 *   而是让 SDK 层 re-export 它们 + 提供基类。runtime 抛出的具体子类
 *   仍可直接 `instanceof` 判定;LokvisError 基类提供"是否 lokvis 域错误"
 *   的快速过滤。
 * - `from(unknown)` 把任意值归一为 LokvisError,便于在 catch 块统一上报。
 */

// runtime 抛出的具体 error class(用于 from() 的 instanceof 判定)。
// SDK 自身也定义同名子类(如 DegradationRejectedError),故给 runtime
// 导入加 Runtime 前缀别名避免命名冲突。
import {
  QuotaExceededError as RuntimeQuotaExceededError,
  DegradationRejectedError as RuntimeDegradationRejectedError,
  OpfsUnavailableError as RuntimeOpfsUnavailableError,
  IdbUnavailableError as RuntimeIdbUnavailableError,
  WorkerCrashedError as RuntimeWorkerCrashedError,
  WorkerRestartingError as RuntimeWorkerRestartingError,
  WorkerDeadError as RuntimeWorkerDeadError,
  WorkerRequestTimeoutError as RuntimeWorkerRequestTimeoutError,
  WorkerHandshakeError as RuntimeWorkerHandshakeError,
  WorkerRequestAbortedError as RuntimeWorkerRequestAbortedError,
} from '@lokvis/runtime';

/**
 * 错误代码枚举(稳定契约,不随实现重构变更)。
 *
 * 命名约定:`<DOMAIN>_<REASON>`,域与 SDK 顶层模块对齐。
 */
export type LokvisErrorCode =
  // 资产域
  | 'ASSET_NOT_FOUND'
  | 'ASSET_IMPORT_FAILED'
  | 'ASSET_EXPORT_FAILED'
  // 工作流域
  | 'WORKFLOW_INVALID'
  | 'WORKFLOW_CYCLE'
  | 'WORKFLOW_NODE_ERROR'
  // 能力域
  | 'CAPABILITY_NOT_REGISTERED'
  | 'CAPABILITY_STUB_ONLY'
  // 存储域
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_OPFS_UNAVAILABLE'
  | 'STORAGE_IDB_UNAVAILABLE'
  // Worker 域
  | 'WORKER_CRASHED'
  | 'WORKER_TIMEOUT'
  | 'WORKER_DEAD'
  | 'WORKER_REQUEST_ABORTED'
  | 'WORKER_HANDSHAKE_FAILED'
  // 降级域
  | 'DEGRADATION_REJECTED'
  // 插件域
  | 'PLUGIN_LOAD_FAILED'
  // 兜底
  | 'UNKNOWN';

/** LokvisError 构造选项 */
export interface LokvisErrorOptions {
  /** 稳定错误代码(程序化分支用) */
  code: LokvisErrorCode;
  /** 原始错误(如有),保留链路便于调试 */
  cause?: unknown;
  /** 附加上下文(随错误一起序列化,便于日志聚合) */
  context?: Record<string, unknown>;
}

/**
 * Lokvis SDK 错误基类。
 *
 * 所有 SDK 抛出的错误都继承此类,消费方可通过 `instanceof LokvisError`
 * 判定"是否 lokvis 域错误",再据 `code` 走分支。
 *
 * @example
 * ```ts
 * try {
 *   await lokvis.run(workflow, [assetId]);
 * } catch (e) {
 *   if (e instanceof LokvisError) {
 *     if (e.code === 'STORAGE_QUOTA_EXCEEDED') alert('存储已满,请清理资产');
 *     else console.error(e.code, e.message, e.context);
 *   } else {
 *     throw e; // 非 lokvis 域错误,继续上抛
 *   }
 * }
 * ```
 */
export class LokvisError extends Error {
  readonly code: LokvisErrorCode;
  readonly context?: Readonly<Record<string, unknown>>;

  constructor(message: string, options: LokvisErrorOptions) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'LokvisError';
    this.code = options.code;
    if (options.context !== undefined) {
      this.context = Object.freeze({ ...options.context });
    }
    // 维持 prototype 链(ES5 target 下 extends Error 会丢失)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 资产未找到 */
export class AssetNotFoundError extends LokvisError {
  readonly assetId: string;
  constructor(assetId: string, cause?: unknown) {
    super(`Asset not found: ${assetId}`, { code: 'ASSET_NOT_FOUND', cause, context: { assetId } });
    this.name = 'AssetNotFoundError';
    this.assetId = assetId;
  }
}

/** 资产导入失败 */
export class AssetImportError extends LokvisError {
  constructor(message: string, cause?: unknown, context?: Record<string, unknown>) {
    super(message, { code: 'ASSET_IMPORT_FAILED', cause, context });
    this.name = 'AssetImportError';
  }
}

/** 资产导出失败 */
export class AssetExportError extends LokvisError {
  constructor(message: string, cause?: unknown, context?: Record<string, unknown>) {
    super(message, { code: 'ASSET_EXPORT_FAILED', cause, context });
    this.name = 'AssetExportError';
  }
}

/** 工作流结构校验失败 */
export class WorkflowInvalidError extends LokvisError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: 'WORKFLOW_INVALID', context });
    this.name = 'WorkflowInvalidError';
  }
}

/** 工作流包含环 */
export class WorkflowCycleError extends LokvisError {
  constructor(message: string) {
    super(message, { code: 'WORKFLOW_CYCLE' });
    this.name = 'WorkflowCycleError';
  }
}

/** 工作流节点执行失败 */
export class WorkflowNodeError extends LokvisError {
  readonly nodeId: string;
  readonly capability: string;
  constructor(nodeId: string, capability: string, message: string, cause?: unknown) {
    super(message, { code: 'WORKFLOW_NODE_ERROR', cause, context: { nodeId, capability } });
    this.name = 'WorkflowNodeError';
    this.nodeId = nodeId;
    this.capability = capability;
  }
}

/** 能力未注册 */
export class CapabilityNotRegisteredError extends LokvisError {
  readonly capability: string;
  constructor(capability: string) {
    super(`No implementation registered for capability "${capability}"`, {
      code: 'CAPABILITY_NOT_REGISTERED',
      context: { capability },
    });
    this.name = 'CapabilityNotRegisteredError';
    this.capability = capability;
  }
}

/** 能力仅有 stub 实现(需安装真实 engine 插件) */
export class CapabilityStubOnlyError extends LokvisError {
  readonly capability: string;
  constructor(capability: string) {
    super(
      `Capability "${capability}" is not yet available (only stub engine registered). ` +
        'Install a real engine plugin to use this capability.',
      { code: 'CAPABILITY_STUB_ONLY', context: { capability } }
    );
    this.name = 'CapabilityStubOnlyError';
    this.capability = capability;
  }
}

/** 存储配额超限 */
export class StorageQuotaExceededError extends LokvisError {
  readonly usage: number;
  readonly delta: number;
  readonly quota: number;
  constructor(usage: number, delta: number, quota: number, cause?: unknown) {
    super(`Storage quota exceeded: usage=${usage} + delta=${delta} > quota=${quota}`, {
      code: 'STORAGE_QUOTA_EXCEEDED',
      cause,
      context: { usage, delta, quota },
    });
    this.name = 'StorageQuotaExceededError';
    this.usage = usage;
    this.delta = delta;
    this.quota = quota;
  }
}

/** OPFS 不可用(浏览器不支持或权限拒绝) */
export class StorageOpfsUnavailableError extends LokvisError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'STORAGE_OPFS_UNAVAILABLE', cause });
    this.name = 'StorageOpfsUnavailableError';
  }
}

/** IndexedDB 不可用(隐私模式或浏览器不支持) */
export class StorageIdbUnavailableError extends LokvisError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'STORAGE_IDB_UNAVAILABLE', cause });
    this.name = 'StorageIdbUnavailableError';
  }
}

/** Worker 崩溃(传输层 error 或心跳超时) */
export class WorkerCrashedError extends LokvisError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'WORKER_CRASHED', cause });
    this.name = 'WorkerCrashedError';
  }
}

/** Worker 请求超时 */
export class WorkerTimeoutError extends LokvisError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'WORKER_TIMEOUT', cause });
    this.name = 'WorkerTimeoutError';
  }
}

/** Worker 已死亡(超过 maxRestarts,无法再恢复) */
export class WorkerDeadError extends LokvisError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'WORKER_DEAD', cause });
    this.name = 'WorkerDeadError';
  }
}

/** Worker 请求被取消(AbortSignal 触发) */
export class WorkerRequestAbortedError extends LokvisError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'WORKER_REQUEST_ABORTED', cause });
    this.name = 'WorkerRequestAbortedError';
  }
}

/** Worker 握手失败(ready 超时或协议不匹配) */
export class WorkerHandshakeError extends LokvisError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'WORKER_HANDSHAKE_FAILED', cause });
    this.name = 'WorkerHandshakeError';
  }
}

/** 降级拒绝(内存压力 critical 且无法安全处理) */
export class DegradationRejectedError extends LokvisError {
  readonly guide: readonly string[];
  constructor(message: string, guide: string[], cause?: unknown) {
    super(message, { code: 'DEGRADATION_REJECTED', cause, context: { guide } });
    this.name = 'DegradationRejectedError';
    this.guide = Object.freeze([...guide]);
  }
}

/** 插件加载/安装失败 */
export class PluginLoadError extends LokvisError {
  readonly pluginName: string;
  constructor(pluginName: string, message: string, cause?: unknown) {
    super(message, { code: 'PLUGIN_LOAD_FAILED', cause, context: { pluginName } });
    this.name = 'PluginLoadError';
    this.pluginName = pluginName;
  }
}

/**
 * 把任意值归一为 LokvisError。
 *
 * - 已是 LokvisError → 原样返回
 * - 是 runtime 抛出的具体 Error 子类(QuotaExceededError 等)→ 包装为对应 SDK 错误
 * - 是普通 Error → 包装为 UNKNOWN LokvisError,保留 cause
 * - 其他 → 字符串化为 message
 *
 * 使用 `instanceof` 而非字符串匹配:SDK 依赖 `@lokvis/runtime`,
 * 可直接引用其导出的 error class,判定准确且不受 message 文案改动影响。
 *
 * @example
 * ```ts
 * import { fromLokvisError } from '@lokvis/sdk';
 *
 * try {
 *   await lokvis.run(wf, [id]);
 * } catch (e) {
 *   const err = fromLokvisError(e);
 *   telemetry.report(err.code, err.message, err.context);
 * }
 * ```
 */
export function fromLokvisError(value: unknown): LokvisError {
  if (value instanceof LokvisError) return value;

  if (value instanceof Error) {
    // 存储配额超限
    if (value instanceof RuntimeQuotaExceededError) {
      return new StorageQuotaExceededError(value.usage, value.delta, value.quota, value);
    }
    // 降级拒绝
    if (value instanceof RuntimeDegradationRejectedError) {
      return new DegradationRejectedError(value.message, value.guide, value);
    }
    // OPFS / IDB 不可用
    if (value instanceof RuntimeOpfsUnavailableError) {
      return new StorageOpfsUnavailableError(value.message, value);
    }
    if (value instanceof RuntimeIdbUnavailableError) {
      return new StorageIdbUnavailableError(value.message, value);
    }
    // Worker 域
    if (value instanceof RuntimeWorkerCrashedError || value instanceof RuntimeWorkerRestartingError) {
      return new WorkerCrashedError(value.message, value);
    }
    if (value instanceof RuntimeWorkerDeadError) {
      return new WorkerDeadError(value.message, value);
    }
    if (value instanceof RuntimeWorkerRequestTimeoutError) {
      return new WorkerTimeoutError(value.message, value);
    }
    if (value instanceof RuntimeWorkerHandshakeError) {
      return new WorkerHandshakeError(value.message, value);
    }
    if (value instanceof RuntimeWorkerRequestAbortedError) {
      return new WorkerRequestAbortedError(value.message, value);
    }
    return new LokvisError(value.message, { code: 'UNKNOWN', cause: value });
  }

  return new LokvisError(String(value), { code: 'UNKNOWN' });
}

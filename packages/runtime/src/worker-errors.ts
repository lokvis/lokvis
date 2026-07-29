/**
 * Worker 错误契约
 *
 * 这 6 个错误类是 Worker 生命周期契约的稳定部分:
 * @lokvis/sdk 的 errors.ts 通过 `instanceof` 将它们映射为 SDK 错误。
 *
 * 历史:早期存在主线程侧的 WorkerHost + WorkerTransport(浏览器 Worker
 * 管理器)实现,但运行时最终收敛为浏览器本地直接执行,该管理器成为死代码
 * 并已删除。这些错误类作为对外契约保留。
 */

/** Worker 崩溃(传输层错误或心跳超时) */
export class WorkerCrashedError extends Error {
  readonly reason: string;
  readonly restartCount: number;
  constructor(reason: string, restartCount: number) {
    super(`Worker crashed: ${reason}`);
    this.name = 'WorkerCrashedError';
    this.reason = reason;
    this.restartCount = restartCount;
  }
}

/** Worker 正在重启,拒绝新请求 */
export class WorkerRestartingError extends Error {
  constructor() {
    super('Worker is restarting');
    this.name = 'WorkerRestartingError';
  }
}

/** Worker 已死亡(超过最大重启次数) */
export class WorkerDeadError extends Error {
  readonly restartCount: number;
  constructor(restartCount: number) {
    super(`Worker is dead after ${restartCount} restart attempts`);
    this.name = 'WorkerDeadError';
    this.restartCount = restartCount;
  }
}

/** 单个请求超时 */
export class WorkerRequestTimeoutError extends Error {
  readonly method: string;
  constructor(method: string, timeoutMs: number) {
    super(`Request "${method}" timed out after ${timeoutMs}ms`);
    this.name = 'WorkerRequestTimeoutError';
    this.method = method;
  }
}

/** ready 握手失败(协议版本不匹配或超时) */
export class WorkerHandshakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerHandshakeError';
  }
}

/** 请求被 AbortSignal 取消 */
export class WorkerRequestAbortedError extends Error {
  readonly method: string;
  constructor(method: string) {
    super(`Request "${method}" was aborted via AbortSignal`);
    this.name = 'WorkerRequestAbortedError';
    this.method = method;
  }
}

/**
 * Worker 通信协议
 *
 * 定义 主线程(Host) ↔ Worker 之间的消息格式与握手/心跳规范。
 * 协议本身与传输层解耦(纯类型 + 常量 + 校验助手),
 * 既可用于浏览器 Web Worker,也可在测试中被 Fake 传输层复用。
 *
 * 设计目标(对应 whitepaper T1「浏览器内存/性能 ★★★★★」与 PROJECT_PLAN 1.6/1.7):
 * - 每个请求有唯一 id,Response 按 id 关联,避免错配。
 * - 心跳(Heartbeat):Host 周期性 ping,Worker 必须在超时内 pong,否则视为崩溃。
 * - Ready 握手:Worker 启动后主动发 ready,Host 据此判定可用。
 * - 错误通道:Worker 主动 error(可恢复) vs 传输层 error/exit(不可恢复,触发重启)。
 *
 * 消息流向:
 *   Host → Worker:  request | ping
 *   Worker → Host:  response | pong | event | ready | error
 */

/** 协议版本(Host 与 Worker 握手时校验,不一致则拒绝) */
export const WORKER_PROTOCOL_VERSION = '0.1.0';

// ─── 默认参数(可通过 WorkerHostOptions 覆盖)──────────────────────
/** 心跳发送间隔 */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000;
/** 心跳超时:超过该时间未收到 pong 视为 Worker 无响应 */
export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 15_000;
/** 单个请求的默认超时 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
/** 崩溃后最大重启次数(超过则放弃,交由上层降级) */
export const DEFAULT_MAX_RESTARTS = 3;
/** Worker 启动后等待 ready 的超时 */
export const DEFAULT_READY_TIMEOUT_MS = 10_000;

// ─── Host → Worker 消息 ─────────────────────────────────────────

/** 请求:Host 调用 Worker 暴露的方法 */
export interface WorkerRequest {
  id: string;
  type: 'request';
  method: string;
  params: unknown;
}

/** 心跳探测 */
export interface WorkerPing {
  id: string;
  type: 'ping';
  ts: number;
}

/**
 * 取消一个正在执行的请求(W3.5 cancel 贯穿)。
 * Host 在 AbortSignal 触发时发送,Worker 据此中止当前计算。
 */
export interface WorkerCancel {
  type: 'cancel';
  /** 要取消的请求 id */
  id: string;
}

export type WorkerMessageToWorker = WorkerRequest | WorkerPing | WorkerCancel;

// ─── Worker → Host 消息 ─────────────────────────────────────────

/** 响应:成功 */
export interface WorkerResponseOk {
  id: string;
  type: 'response';
  ok: true;
  result: unknown;
}

/** 响应:失败 */
export interface WorkerResponseErr {
  id: string;
  type: 'response';
  ok: false;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export type WorkerResponse = WorkerResponseOk | WorkerResponseErr;

/**
 * BlobRef:Blob 的可转移信封(W21.4 Transferable 优化)。
 *
 * Blob 本身不是 Transferable,只有 ArrayBuffer 是。Worker 把处理后的
 * Blob 拆成 { meta, buffer },通过 postMessage 的 transfer list 零拷贝
 * 移交 ArrayBuffer 给主线程;主线程收到后用
 * `new Blob([buffer], { type: meta.type })` 重组。
 *
 * 协议约定(与 packages/engine-image/src/worker-adapter.ts 的 BlobRef 同步声明,
 * 遵循 AGENTS.md 中 WorkerCancel 的先例——两处各自声明,注释标注同步):
 * - response.result.kind === 'blob' → 解包 BlobRef,重组 Blob
 * - response.result 无 kind 字段 → 非 Blob 结果(如元数据),直接使用
 */
export interface BlobRef {
  kind: 'blob';
  meta: { size: number; type: string };
  buffer: ArrayBuffer;
}

/** 类型守卫:是否为 BlobRef 信封(W21.4) */
export function isBlobRef(data: unknown): data is BlobRef {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { kind?: unknown }).kind === 'blob' &&
    typeof (data as { meta?: unknown }).meta === 'object' &&
    (data as { buffer?: unknown }).buffer instanceof ArrayBuffer
  );
}

/**
 * 解包 BlobRef:若 result 为 BlobRef 信封,重组为 Blob;
 * 否则原样返回(W21.4)。
 *
 * 供 WorkerHost.handleMessage 在 resolve pending 前调用。
 */
export function unwrapBlobRef(result: unknown): unknown {
  if (isBlobRef(result)) {
    return new Blob([result.buffer], { type: result.meta.type });
  }
  return result;
}

/** 心跳回应 */
export interface WorkerPong {
  id: string;
  type: 'pong';
  ts: number;
}

/** Worker 主动事件(进度、日志等,无需 ack) */
export interface WorkerEvent {
  type: 'event';
  event: string;
  payload?: unknown;
}

/** Worker 就绪(启动后主动发送,携带协议版本) */
export interface WorkerReady {
  type: 'ready';
  protocolVersion: string;
}

/** Worker 主动上报的致命错误(自身仍存活但无法继续) */
export interface WorkerFatalError {
  type: 'error';
  message: string;
  stack?: string;
}

export type WorkerMessageToHost =
  | WorkerResponse
  | WorkerPong
  | WorkerEvent
  | WorkerReady
  | WorkerFatalError;

// ─── 助手函数 ───────────────────────────────────────────────────

/** 生成唯一请求/心跳 id */
export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 类型守卫:是否为 Worker → Host 消息 */
export function isWorkerMessageToHost(
  data: unknown
): data is WorkerMessageToHost {
  if (typeof data !== 'object' || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return (
    type === 'response' ||
    type === 'pong' ||
    type === 'event' ||
    type === 'ready' ||
    type === 'error'
  );
}

/** 类型守卫:是否为响应消息 */
export function isWorkerResponse(data: unknown): data is WorkerResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'response' &&
    typeof (data as { id?: unknown }).id === 'string' &&
    typeof (data as { ok?: unknown }).ok === 'boolean'
  );
}

/** 类型守卫:是否为 pong */
export function isWorkerPong(data: unknown): data is WorkerPong {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'pong'
  );
}

/** 类型守卫:是否为 ready */
export function isWorkerReady(data: unknown): data is WorkerReady {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'ready'
  );
}

/** 类型守卫:是否为 Worker 主动事件 */
export function isWorkerEvent(data: unknown): data is WorkerEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'event' &&
    typeof (data as { event?: unknown }).event === 'string'
  );
}

/** 类型守卫:是否为 Worker 主动上报错误 */
export function isWorkerFatalError(data: unknown): data is WorkerFatalError {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'error'
  );
}

/** 协议版本是否兼容(目前采用严格相等) */
export function isProtocolCompatible(version: string): boolean {
  return version === WORKER_PROTOCOL_VERSION;
}

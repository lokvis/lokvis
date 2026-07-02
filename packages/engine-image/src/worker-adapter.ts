/**
 * Engine Image Worker Adapter —— 图像操作在 Web Worker 内运行
 *
 * 本模块运行在 Worker 线程,接收主线程(WorkerHost)的协议消息,
 * 调用 engine-image 的 operations(基于 OffscreenCanvas / createImageBitmap),
 * 把结果 Blob 回传主线程。
 *
 * 设计要点(对应 PROJECT_PLAN 1.8):
 * - Canvas 引擎的 createCanvas() 已优先使用 OffscreenCanvas,Worker 内可直接渲染。
 * - 输入 Blob 通过结构化克隆传入;结果 Blob 同样克隆回传(MVP 简化,后续可改 Transferable)。
 * - 消息格式与 @lokvis/runtime 的 worker-protocol 结构兼容(纯 JSON),
 *   但本模块不依赖 runtime,保持 Engine 层仅依赖 @lokvis/schema。
 *
 * 使用:在 Worker 入口文件中调用 `startImageWorker()` 即可。
 */

import {
  resize,
  compress,
  convert,
  crop,
  rotate,
  flip,
  watermark,
  setBackground,
} from './operations/index.js';
import { canvasEngine, detectFormatSupport } from './canvas-engine.js';
import type {
  BackgroundParams,
  CompressParams,
  ConvertParams,
  CropParams,
  FlipParams,
  ResizeParams,
  RotateParams,
  WatermarkParams,
} from './types.js';

// ─── 本地协议类型(与 @lokvis/runtime worker-protocol 结构兼容)──
// 独立声明以避免 engine-image → runtime 的跨层依赖。
const PROTOCOL_VERSION = '0.1.0';

interface WorkerRequest {
  id: string;
  type: 'request';
  method: string;
  params: unknown;
}
interface WorkerResponseOk {
  id: string;
  type: 'response';
  ok: true;
  result: unknown;
}
interface WorkerResponseErr {
  id: string;
  type: 'response';
  ok: false;
  error: { message: string; code?: string; stack?: string };
}
export type WorkerResponse = WorkerResponseOk | WorkerResponseErr;

interface WorkerPing {
  id: string;
  type: 'ping';
  ts: number;
}
interface WorkerPong {
  id: string;
  type: 'pong';
  ts: number;
}
interface WorkerReady {
  type: 'ready';
  protocolVersion: string;
}
/**
 * 取消一个正在执行的请求(W3.5 cancel 贯穿)。
 * 与 @lokvis/runtime worker-protocol 的 WorkerCancel 结构兼容,
 * 本地声明以避免 engine-image → runtime 跨层依赖。
 */
interface WorkerCancel {
  type: 'cancel';
  /** 要取消的请求 id */
  id: string;
}

/** 图像操作请求参数:统一 { input, options } 结构 */
interface ImageRequestParams {
  input: Blob;
  options?:
    | ResizeParams
    | CompressParams
    | ConvertParams
    | CropParams
    | RotateParams
    | FlipParams
    | WatermarkParams
    | BackgroundParams;
}

/** 探测结果(不含 ImageBitmap,便于结构化克隆回传) */
export interface ImageProbeResult {
  width: number;
  height: number;
  mimeType: string;
  format: string;
  size: number;
}

/** 方法名 → 处理函数。能力名与 canvasEngine.supportedCapabilities 对齐(带 `image.` 前缀) */
const METHODS: Record<
  string,
  (params: ImageRequestParams, signal?: AbortSignal) => Promise<unknown>
> = {
  'image.resize': (p, signal) => resize(p.input, (p.options ?? {}) as ResizeParams, signal),
  'image.compress': (p, signal) => compress(p.input, (p.options ?? {}) as CompressParams, signal),
  'image.convert': (p, signal) => convert(p.input, (p.options ?? {}) as ConvertParams, signal),
  'image.crop': (p, signal) => crop(p.input, (p.options ?? {}) as CropParams, signal),
  'image.rotate': (p, signal) => rotate(p.input, (p.options ?? {}) as RotateParams, signal),
  'image.flip': (p, signal) => flip(p.input, (p.options ?? {}) as FlipParams, signal),
  'image.watermark': (p, signal) => watermark(p.input, (p.options ?? {}) as WatermarkParams, signal),
  'image.background': (p, signal) =>
    setBackground(p.input, (p.options ?? {}) as BackgroundParams, signal),
};

/** 列出本 Worker 支持的方法名 */
export function listImageWorkerMethods(): string[] {
  return Object.keys(METHODS);
}

/**
 * 派发单个方法调用(纯函数,可单测)。
 * 抛错由调用方捕获并转成 WorkerResponse.err。
 *
 * W3.5:接受可选 AbortSignal 并下传给操作,使 cancel 能在 canvas
 * decode/encode 之间生效。AbortError 会被上层 catch 转为 err 响应。
 */
export async function dispatchImageMethod(
  method: string,
  params: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  // 无输入方法
  if (method === 'image.detectFormats') {
    return detectFormatSupport();
  }
  if (method === 'image.probe') {
    return probeImage(params);
  }

  const handler = METHODS[method];
  if (!handler) {
    throw new Error(`Unknown image method: ${method}`);
  }
  const p = params as Partial<ImageRequestParams>;
  if (!(p.input instanceof Blob)) {
    throw new Error(`Method "${method}" requires params.input (Blob)`);
  }
  return handler(p as ImageRequestParams, signal);
}

/** 探测图像尺寸/格式(关闭 bitmap,仅返回可克隆的元数据) */
async function probeImage(params: unknown): Promise<ImageProbeResult> {
  const p = params as { input?: Blob };
  if (!(p.input instanceof Blob)) {
    throw new Error('image.probe requires params.input (Blob)');
  }
  const { bitmap, width, height } = await canvasEngine.decode(p.input);
  bitmap.close?.();
  const mimeType = p.input.type || 'application/octet-stream';
  const format = mimeType.split('/')[1] ?? 'bin';
  return { width, height, mimeType, format, size: p.input.size };
}

/**
 * 创建请求处理器(纯函数,返回响应)。供测试直接调用,
 * 也供 startImageWorker 在 Worker 内使用。
 *
 * W3.5:接受可选 AbortSignal 并下传,使 Host 的 cancel 经由
 * startImageWorker 的 inflight 控制器抵达操作。
 */
export function createImageWorkerHandler(): (
  request: WorkerRequest,
  signal?: AbortSignal
) => Promise<WorkerResponse> {
  return async (request, signal) => {
    try {
      const result = await dispatchImageMethod(request.method, request.params, signal);
      return { id: request.id, type: 'response', ok: true, result };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return {
        id: request.id,
        type: 'response',
        ok: false,
        error: { message: err.message, stack: err.stack },
      };
    }
  };
}

// ─── Worker 入口接线 ────────────────────────────────────────────

/** Worker 作用域的最小接口(屏蔽 DOM/WebWorker lib 类型歧义) */
interface ImageWorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message' | 'messageerror',
    handler: (ev: MessageEvent) => void
  ): void;
}

function toResponseError(e: unknown): {
  message: string;
  code?: string;
  stack?: string;
} {
  if (e instanceof Error) return { message: e.message, stack: e.stack };
  return { message: String(e) };
}

/**
 * 在 Worker 入口安装图像处理逻辑:
 * - 立即发送 ready(携带协议版本)。
 * - 收到 ping → 回 pong。
 * - 收到 request → 派发并回 response;同时把 AbortController 登记到
 *   inflight 表,使 cancel 能及时中止在途操作(W3.5)。
 * - 收到 cancel → 查表中止对应请求的 AbortController。
 * - 收到 messageerror → 忽略(主线程会因超时重启)。
 *
 * @param scope Worker 全局对象,默认 `self`。测试可注入 Fake。
 */
export function startImageWorker(scope?: ImageWorkerScope): ImageWorkerScope {
  const workerScope: ImageWorkerScope =
    scope ??
    (typeof self !== 'undefined'
      ? (self as unknown as ImageWorkerScope)
      : throwNoSelf());

  // 1. 握手
  const ready: WorkerReady = { type: 'ready', protocolVersion: PROTOCOL_VERSION };
  workerScope.postMessage(ready);

  const handle = createImageWorkerHandler();
  /** 在途请求的 AbortController 表:cancel 消息据此中止操作(W3.5) */
  const inflight = new Map<string, AbortController>();

  workerScope.addEventListener('message', async (ev: MessageEvent) => {
    const data: unknown = ev.data;
    if (typeof data !== 'object' || data === null) return;
    const type = (data as { type?: unknown }).type;

    if (type === 'ping') {
      const ping = data as WorkerPing;
      const pong: WorkerPong = { id: ping.id, type: 'pong', ts: Date.now() };
      workerScope.postMessage(pong);
      return;
    }
    if (type === 'cancel') {
      const cancel = data as WorkerCancel;
      const controller = inflight.get(cancel.id);
      if (controller) {
        controller.abort();
        inflight.delete(cancel.id);
      }
      return;
    }
    if (type === 'request') {
      const req = data as WorkerRequest;
      const controller = new AbortController();
      inflight.set(req.id, controller);
      try {
        const response = await handle(req, controller.signal);
        workerScope.postMessage(response);
      } catch (e) {
        // handler 内部已捕获业务错误;这里只兜底传输异常
        workerScope.postMessage({
          id: req.id,
          type: 'response',
          ok: false,
          error: toResponseError(e),
        } satisfies WorkerResponseErr);
      } finally {
        inflight.delete(req.id);
      }
    }
  });

  return workerScope;
}

function throwNoSelf(): never {
  throw new Error(
    'startImageWorker() requires a Worker scope; no global `self` found. ' +
      'Pass an explicit scope or call from within a Web Worker.'
  );
}

export { PROTOCOL_VERSION as IMAGE_WORKER_PROTOCOL_VERSION };

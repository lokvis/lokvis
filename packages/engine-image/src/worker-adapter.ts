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
const METHODS: Record<string, (params: ImageRequestParams) => Promise<unknown>> = {
  'image.resize': (p) => resize(p.input, (p.options ?? {}) as ResizeParams),
  'image.compress': (p) => compress(p.input, (p.options ?? {}) as CompressParams),
  'image.convert': (p) => convert(p.input, (p.options ?? {}) as ConvertParams),
  'image.crop': (p) => crop(p.input, (p.options ?? {}) as CropParams),
  'image.rotate': (p) => rotate(p.input, (p.options ?? {}) as RotateParams),
  'image.flip': (p) => flip(p.input, (p.options ?? {}) as FlipParams),
  'image.watermark': (p) => watermark(p.input, (p.options ?? {}) as WatermarkParams),
  'image.background': (p) =>
    setBackground(p.input, (p.options ?? {}) as BackgroundParams),
};

/** 列出本 Worker 支持的方法名 */
export function listImageWorkerMethods(): string[] {
  return Object.keys(METHODS);
}

/**
 * 派发单个方法调用(纯函数,可单测)。
 * 抛错由调用方捕获并转成 WorkerResponse.err。
 */
export async function dispatchImageMethod(
  method: string,
  params: unknown
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
  return handler(p as ImageRequestParams);
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
 */
export function createImageWorkerHandler(): (
  request: WorkerRequest
) => Promise<WorkerResponse> {
  return async (request) => {
    try {
      const result = await dispatchImageMethod(request.method, request.params);
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
 * - 收到 request → 派发并回 response。
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
    if (type === 'request') {
      try {
        const response = await handle(data as WorkerRequest);
        workerScope.postMessage(response);
      } catch (e) {
        // handler 内部已捕获业务错误;这里只兜底传输异常
        const req = data as WorkerRequest;
        workerScope.postMessage({
          id: req.id,
          type: 'response',
          ok: false,
          error: toResponseError(e),
        } satisfies WorkerResponseErr);
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

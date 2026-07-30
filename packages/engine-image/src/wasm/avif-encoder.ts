/**
 * AVIF WASM 编码器 host 侧桥接（设计文档 D2：编码器私有 worker）
 *
 * 设计要点：
 * - 模块级 Worker 单例：codec 初始化（wasm 实例化 ~0.4s）只发生一次，
 *   后续编码复用；pending Map 按 requestId 多路复用同一 worker
 * - RGBA buffer 以 transferable 传输（零拷贝）；传输后调用方持有的
 *   ImageData 失效——调用约定：调用方不得复用已传入的 ImageData
 * - 取消语义（D5）：@jsquash/avif 的编码是单次同步 wasm 调用，无中断钩子，
 *   abort = terminate worker 并重建单例。并发 in-flight 请求会一并失败
 *   （以 AbortError 拒绝）——这是可接受的边缘情况：取消方本就放弃了结果，
 *   被连带方重试一次即可（批量场景由上层 job 重试覆盖）
 */
import { isWorkerSupported } from '@lokvis/browser-adapter';
import { resolveAvifWasmUrl } from '../wasm-config.js';
import { throwIfAborted } from '../operations/utils.js';

/** host → worker 编码请求 */
export interface AvifEncodeRequest {
  id: number;
  /** RGBA 像素（transferable，传输后 detach） */
  data: ArrayBuffer;
  width: number;
  height: number;
  /** 质量 0-100；speed 分档由 worker 按 D7 策略决定 */
  quality: number;
  /** wasm 二进制 URL（worker 是独立 realm，读不到主线程配置，随消息传递） */
  wasmUrl: string;
}

/** worker → host 编码响应 */
export type AvifEncodeResponse =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

interface PendingRequest {
  resolve: (buffer: ArrayBuffer) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<number, PendingRequest>();

function failAllPending(error: Error): void {
  for (const [, p] of pending) {
    p.reject(error);
  }
  pending.clear();
}

function createWorker(): Worker {
  if (!isWorkerSupported()) {
    throw new Error('Web Worker is not supported in this environment');
  }
  // ADR-015 豁免:`new Worker(new URL(...))` 必须保持字面量形态,
  // Vite/webpack 依赖该语法静态识别并打包 worker chunk;经 adapter
  // 函数间接创建会破坏打包。仅探测(isWorkerSupported)走 adapter。
  const w = new Worker(new URL('./avif-worker.js', import.meta.url), {
    type: 'module',
  });
  w.addEventListener('message', (e: MessageEvent<AvifEncodeResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) {
      p.resolve(e.data.buffer);
    } else {
      p.reject(new Error(e.data.error));
    }
  });
  w.addEventListener('error', () => {
    // worker 崩溃（wasm 加载失败 / OOM）：拒绝所有 in-flight 请求，
    // 清空单例使下一次编码自动重建
    failAllPending(new Error('AVIF encoder worker crashed'));
    worker = null;
  });
  return w;
}

/** 终止 worker 单例（取消 / 崩溃重建时使用；D5） */
export function terminateAvifWorker(): void {
  if (!worker) return;
  worker.terminate();
  worker = null;
}

/**
 * 用 WASM（libavif）把 RGBA 像素编码为 AVIF。
 *
 * @param imageData 画布像素（编码后其 data buffer 被 detach，不可复用）
 * @param quality 质量 0-100
 * @param signal 可选取消信号；abort 时 terminate worker 并以 AbortError 拒绝
 */
export async function encodeAvifWasm(
  imageData: ImageData,
  quality: number,
  signal?: AbortSignal
): Promise<Blob> {
  throwIfAborted(signal);
  worker ??= createWorker();
  const w = worker;
  const id = nextRequestId++;
  const { data, width, height } = imageData;

  return new Promise<Blob>((resolve, reject) => {
    const onAbort = () => {
      // 拒绝所有 in-flight 请求（含本次发起方）并清空 pending；
      // 不预先 delete(id)——否则发起方自身的 promise 永不 settle（悬挂泄漏），
      // 与预取消路径 throwIfAborted 抛 AbortError 的语义保持一致
      failAllPending(new DOMException('Operation aborted', 'AbortError'));
      terminateAvifWorker();
    };
    const settle = <T>(fn: () => T): T => {
      signal?.removeEventListener('abort', onAbort);
      return fn();
    };
    pending.set(id, {
      resolve: (buffer) =>
        settle(() => resolve(new Blob([buffer], { type: 'image/avif' }))),
      reject: (error) => settle(() => reject(error)),
    });
    signal?.addEventListener('abort', onAbort, { once: true });

    const buffer = data.buffer as ArrayBuffer;
    const request: AvifEncodeRequest = {
      id,
      data: buffer,
      width,
      height,
      quality,
      wasmUrl: resolveAvifWasmUrl(),
    };
    w.postMessage(request, [buffer]);
  });
}

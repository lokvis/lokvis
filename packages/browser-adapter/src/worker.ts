/**
 * WorkerFactory —— Web Worker 创建封装(ADR-015)
 *
 * 收编 engine-image/src/wasm/avif-encoder.ts 的 `new Worker(...)`。
 * 环境安全:Worker 不可用时抛语义化错误,调用方走降级链
 * (如 AVIF WASM → canvas 编码)。
 */

/** 是否支持 Web Worker */
export function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * 创建 Web Worker。
 *
 * 全仓唯一允许出现 `new Worker(...)` 的非 Presentation 调用点
 * (runtime worker-host 的存量实现迁移随后续任务处理)。
 */
export function createWorker(url: URL | string, options?: WorkerOptions): Worker {
  if (!isWorkerSupported()) {
    throw new Error('Web Worker is not supported in this environment');
  }
  return new Worker(url, options);
}

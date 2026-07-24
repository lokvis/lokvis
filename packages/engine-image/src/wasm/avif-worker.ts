/**
 * AVIF WASM 编码器 worker 入口（设计文档 D2 私有 worker / D6 强制单线程）
 *
 * 关键决策落点：
 * - 不使用 @jsquash/avif 顶层 encode.js 的 init()——它在浏览器侧自动探测
 *   threads()（SharedArrayBuffer 可用时）加载 mt 版胶水，emscripten pthread
 *   会在本 module worker 内嵌套创建子 worker，URL 解析在消费方 bundler 下
 *   不可控。此处直接绑定单线程胶水 avif_enc.js（D6）。
 * - wasm 二进制经 wasmBinary 注入（D4）：host 侧把配置解析好的 URL 随消息
 *   传入（worker 是独立 realm，读不到主线程的 configureWasmEncoders 配置）。
 * - speed 分档（D7）：quality >= 80 → speed 8（高档位求快，targetSize 二分
 *   搜索会连续编码多次）；quality < 80 → speed 6（低档位求体积效率）。
 * - 无进度/中断钩子（D5）：编码是单次同步 wasm 调用，取消由 host 侧
 *   terminate worker 实现，本文件不处理 cancel 消息。
 */
import avifModuleFactory from '@jsquash/avif/codec/enc/avif_enc.js';
import { defaultOptions } from '@jsquash/avif/meta.js';
import type { AvifEncodeRequest, AvifEncodeResponse } from './avif-encoder.js';

/** 单线程 wasm 模块的最小契约（与 avif_enc.d.ts 的 AVIFModule.encode 一致） */
interface AvifWasmModule {
  encode(
    data: BufferSource,
    width: number,
    height: number,
    options: typeof defaultOptions
  ): Uint8Array | null;
}

type AvifModuleFactory = (opts: {
  noInitialRun?: boolean;
  wasmBinary?: ArrayBuffer;
}) => Promise<AvifWasmModule>;

const createModule = avifModuleFactory as AvifModuleFactory;

let modulePromise: Promise<AvifWasmModule> | null = null;
let loadedFrom = '';

/** codec 单例：wasm 实例化只发生一次；wasmUrl 变化时重新加载 */
function ensureModule(wasmUrl: string): Promise<AvifWasmModule> {
  if (modulePromise && loadedFrom === wasmUrl) {
    return modulePromise;
  }
  loadedFrom = wasmUrl;
  modulePromise = (async () => {
    const resp = await fetch(wasmUrl);
    if (!resp.ok) {
      throw new Error(
        `Failed to load AVIF encoder: ${resp.status} ${resp.statusText}`
      );
    }
    const wasmBinary = await resp.arrayBuffer();
    return createModule({ noInitialRun: true, wasmBinary });
  })();
  return modulePromise;
}

addEventListener('message', async (e: MessageEvent<AvifEncodeRequest>) => {
  const { id, data, width, height, quality, wasmUrl } = e.data;
  try {
    const mod = await ensureModule(wasmUrl);
    const output = mod.encode(new Uint8Array(data), width, height, {
      ...defaultOptions,
      quality,
      speed: quality >= 80 ? 8 : 6,
    });
    if (!output) {
      throw new Error('AVIF encoding failed');
    }
    const buffer = output.buffer as ArrayBuffer;
    const response: AvifEncodeResponse = { id, ok: true, buffer };
    postMessage(response, [buffer]);
  } catch (err) {
    const response: AvifEncodeResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    postMessage(response);
  }
});

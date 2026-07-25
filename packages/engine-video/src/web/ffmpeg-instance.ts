/**
 * ffmpeg.wasm 单例管理(浏览器端)
 *
 * 设计:
 * - 懒加载:首次操作时才初始化 FFmpeg 实例(避免 ~30MB wasm 阻塞首屏)
 * - 单例 + loading promise:防止并发初始化
 * - 可配置:通过 configureFfmpegWasm() 设置 core/wasm URL(CDN 或自托管)
 * - 默认使用 unpkg CDN 的 @ffmpeg/core 单线程版(无需 COOP/COEP)
 *
 * 单线程 vs 多线程:
 * - @ffmpeg/core(单线程):~32MB,无 SharedArrayBuffer 要求,兼容性最好
 * - @ffmpeg/core-mt(多线程):需 COOP/COEP 头,性能更好但部署受限
 * - 默认选择单线程,消费方可通过 config.coreURL 切换到多线程版本
 *
 * AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow。
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg';

/** ffmpeg.wasm 加载配置 */
export interface FfmpegWasmConfig {
  /** ffmpeg-core.js 的 URL(默认 unpkg CDN 单线程版) */
  coreURL?: string;
  /** ffmpeg-core.wasm 的 URL(默认 unpkg CDN 单线程版) */
  wasmURL?: string;
  /** 是否启用多线程(需 COOP/COEP,默认 false) */
  multithread?: boolean;
}

/** 默认 CDN 基础路径(@ffmpeg/core 单线程) */
const DEFAULT_CDN_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
/** 多线程 CDN 基础路径(@ffmpeg/core-mt) */
const DEFAULT_MT_CDN_BASE = 'https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/umd';

/** 全局配置(可通过 configureFfmpegWasm 覆盖) */
let config: FfmpegWasmConfig = {};

/** 单例实例 */
let ffmpegInstance: FFmpeg | null = null;
/** 加载中的 promise(防止并发初始化) */
let loadingPromise: Promise<FFmpeg> | null = null;
/** 代际计数器(使配置变更前的 in-flight 加载失效) */
let generation = 0;

/**
 * 配置 ffmpeg.wasm 加载参数
 *
 * 必须在首次视频操作前调用。典型用法:
 * - 使用自托管 wasm:configureFfmpegWasm({ coreURL: '/wasm/ffmpeg-core.js', wasmURL: '/wasm/ffmpeg-core.wasm' })
 * - 使用多线程:configureFfmpegWasm({ multithread: true })(需 COOP/COEP)
 *
 * 调用后会终止已有实例并重置加载状态,下次操作时按新配置重新加载。
 *
 * @param cfg 配置项(部分覆盖)
 */
export function configureFfmpegWasm(cfg: FfmpegWasmConfig): void {
  config = { ...config, ...cfg };
  // 终止旧实例(释放 Worker 资源)
  if (ffmpegInstance) {
    void ffmpegInstance.terminate();
    ffmpegInstance = null;
  }
  // 递增代际,使 in-flight 加载完成后不写入 ffmpegInstance
  generation++;
  loadingPromise = null;
}

/** 获取当前配置(只读) */
export function getFfmpegWasmConfig(): Readonly<FfmpegWasmConfig> {
  return { ...config };
}

/**
 * 获取已初始化的 FFmpeg 实例(懒加载单例)
 *
 * 首次调用时动态 import @ffmpeg/ffmpeg 并加载 wasm,
 * 后续调用直接返回已有实例。
 *
 * @throws 加载失败时抛出错误(网络/wasm 编译等)
 */
export async function getFfmpegInstance(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  const currentGen = generation;
  loadingPromise = (async () => {
    const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const instance = new FFmpegClass();

    const base = config.multithread ? DEFAULT_MT_CDN_BASE : DEFAULT_CDN_BASE;
    const coreURL = config.coreURL ?? `${base}/ffmpeg-core.js`;
    const wasmURL = config.wasmURL ?? `${base}/ffmpeg-core.wasm`;

    await instance.load({
      coreURL: await toBlobURL(coreURL, 'text/javascript'),
      wasmURL: await toBlobURL(wasmURL, 'application/wasm'),
      ...(config.multithread
        ? { workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript') }
        : {}),
    });

    // 代际校验:若加载期间配置已变更,终止本次实例并抛错
    if (generation !== currentGen) {
      void instance.terminate();
      throw new Error('ffmpeg.wasm load cancelled: configuration changed during loading');
    }

    ffmpegInstance = instance;
    return instance;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    // 加载失败时清除 promise,允许重试
    loadingPromise = null;
    throw new Error(
      `Failed to load ffmpeg.wasm: ${err instanceof Error ? err.message : String(err)}. ` +
        `Ensure network access to the wasm CDN or configure custom URLs via configureFfmpegWasm().`
    );
  }
}

/**
 * 重置 FFmpeg 实例(用于测试或内存释放)
 *
 * 调用后下次操作将重新加载 wasm。
 */
export function resetFfmpegInstance(): void {
  if (ffmpegInstance) {
    void ffmpegInstance.terminate();
    ffmpegInstance = null;
  }
  loadingPromise = null;
}

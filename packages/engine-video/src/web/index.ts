/**
 * @lokvis/engine-video/web
 *
 * 浏览器端 Video Engine(基于 ffmpeg.wasm)— Blob↔Blob 纯函数操作。
 *
 * 与默认入口(stub)的区别:
 * - 默认入口所有操作为 stub(不加载 wasm)
 * - Web 版通过 @ffmpeg/ffmpeg 在浏览器中执行真实视频处理
 *
 * ffmpeg.wasm 懒加载:首次操作时才拉取 ~32MB wasm 文件(单线程版,无需 COOP/COEP)。
 * 可通过 configureFfmpegWasm() 配置 CDN 或自托管 URL。
 *
 * @example
 * ```ts
 * import { compressVideo, configureFfmpegWasm } from '@lokvis/engine-video/web';
 *
 * // 可选:配置自托管 wasm
 * configureFfmpegWasm({ coreURL: '/wasm/ffmpeg-core.js', wasmURL: '/wasm/ffmpeg-core.wasm' });
 *
 * const output = await compressVideo(inputBlob, { crf: 28, scale: 0.75 });
 * ```
 */

export {
  compressVideo,
  transcodeVideo,
  trimVideo,
  mergeVideos,
  extractAudio,
  toGif,
  screenshotVideo,
  getVideoInfo,
} from './operations.js';

export {
  configureFfmpegWasm,
  getFfmpegWasmConfig,
  resetFfmpegInstance,
  type FfmpegWasmConfig,
} from './ffmpeg-instance.js';

import type { VideoEngineDescriptor } from '../types.js';

/** Web 视频引擎描述符(ffmpeg.wasm)— 真实实现,version 不含 'stub' */
export const VIDEO_ENGINE: VideoEngineDescriptor = {
  name: 'ffmpeg-wasm',
  version: '0.7.1',
};

export type {
  VideoEngineDescriptor,
  VideoOutputFormat,
  VideoTranscodeParams,
  VideoTrimParams,
  VideoCompressParams,
  VideoMergeParams,
  VideoExtractAudioParams,
  VideoToGifParams,
  VideoScreenshotParams,
  VideoInfo,
} from '../types.js';

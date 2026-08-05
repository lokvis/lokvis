/**
 * Video Tools Plugin — 浏览器环境版本(基于 ffmpeg.wasm 引擎)
 *
 * 通过子路径 `@lokvis/plugin-video/web` 导出:
 *   import { videoToolsPluginWeb } from '@lokvis/plugin-video/web';
 *
 * 本文件为 thin wrapper,实际逻辑由 real-plugin.ts 的 buildRealVideoPlugin 处理。
 *
 * ffmpeg.wasm 经 engine-video/web 内部懒加载(首次操作时按需拉取 ~32MB),
 * 不会进入消费方首屏 bundle。
 */
import {
  compressVideo,
  transcodeVideo,
  trimVideo,
  mergeVideos,
  extractAudio,
  toGif,
  screenshotVideo,
  getVideoInfo,
  VIDEO_ENGINE,
} from '@lokvis/engine-video/web';
import { buildRealVideoPlugin } from './real-plugin.js';
import type { SingleVideoOperation, MergeVideoOperation } from './real-plugin.js';

/** Web 引擎名(单一来源:engine-video/web 的 VIDEO_ENGINE 描述符) */
export const PLUGIN_ENGINE_WEB = VIDEO_ENGINE.name;

/**
 * 创建视频工具插件(浏览器环境,基于 ffmpeg.wasm 引擎)
 *
 * 7 个真实操作(compress/transcode/trim/merge/extract-audio/to-gif/screenshot),
 * ffmpeg.wasm 按需懒加载,不影响首屏。
 */
export function videoToolsPluginWeb() {
  return buildRealVideoPlugin(
    {
      engineName: PLUGIN_ENGINE_WEB,
      logEngineDesc: 'ffmpeg.wasm engine, browser',
      permissions: ['asset:read', 'asset:write', 'network:limited'],
    },
    {
      compress: compressVideo as SingleVideoOperation,
      transcode: transcodeVideo as SingleVideoOperation,
      trim: trimVideo as SingleVideoOperation,
      extractAudio: extractAudio as SingleVideoOperation,
      toGif: toGif as SingleVideoOperation,
      screenshot: screenshotVideo as SingleVideoOperation,
      merge: mergeVideos as MergeVideoOperation,
      getVideoInfo,
    }
  );
}

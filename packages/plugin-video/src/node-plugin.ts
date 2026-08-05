/**
 * Video Tools Plugin — Node 环境版本(基于 ffmpeg-static 引擎)
 *
 * 通过子路径 `@lokvis/plugin-video/node` 导出:
 *   import { videoToolsPluginNode } from '@lokvis/plugin-video/node';
 *
 * 本文件为 thin wrapper,实际逻辑由 real-plugin.ts 的 buildRealVideoPlugin 处理。
 */
import {
  compressVideo as opCompressVideo,
  transcodeVideo as opTranscodeVideo,
  trimVideo as opTrimVideo,
  mergeVideos as opMergeVideos,
  extractAudio as opExtractAudio,
  toGif as opToGif,
  screenshotVideo as opScreenshotVideo,
  getVideoInfo,
  VIDEO_ENGINE,
} from '@lokvis/engine-video/node';
import { buildRealVideoPlugin, VIDEO_INFO_READER_NAME } from './real-plugin.js';
import type { SingleVideoOperation, MergeVideoOperation } from './real-plugin.js';

/** Node 引擎名(单一来源:engine-video/node 的 VIDEO_ENGINE 描述符) */
export const PLUGIN_ENGINE_NODE = VIDEO_ENGINE.name;

/** 元数据读取器名称(重导出,供测试使用) */
export { VIDEO_INFO_READER_NAME };

/**
 * 创建视频工具插件(Node 环境,基于 ffmpeg-static 引擎)
 *
 * 7 真实 capability(compress / transcode / trim / merge / extract-audio /
 * to-gif / screenshot)+ VideoInfo reader。
 */
export async function videoToolsPluginNode() {
  return buildRealVideoPlugin(
    {
      engineName: PLUGIN_ENGINE_NODE,
      logEngineDesc: 'ffmpeg-static engine',
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    {
      compress: opCompressVideo as SingleVideoOperation,
      transcode: opTranscodeVideo as SingleVideoOperation,
      trim: opTrimVideo as SingleVideoOperation,
      extractAudio: opExtractAudio as SingleVideoOperation,
      toGif: opToGif as SingleVideoOperation,
      screenshot: opScreenshotVideo as SingleVideoOperation,
      merge: opMergeVideos as MergeVideoOperation,
      getVideoInfo,
    }
  );
}

/**
 * Video Blob↔Blob 操作(浏览器版,全 stub)
 *
 * 与 engine-pdf 的 operations.ts 模式对齐:暴露独立操作的纯函数,
 * 供 plugin-video 在 installer 中绑定到 capability。
 *
 * 浏览器版所有操作标记为 stub:
 * - 真实视频处理需要 ffmpeg.wasm(~30MB)或 WebCodecs,体积大且需要
 *   SharedArrayBuffer/COOP/COEP 隔离环境
 * - 浏览器用户应通过 MCP Server(Node 端 ffmpeg-static)处理视频
 * - 真实 Node 端操作由 `@lokvis/engine-video/node` 提供,经子路径导出
 *
 * AGENTS.md Stub Engine 约定:
 * - 所有 operation 方法抛出 `new Error('xxx not implemented in stub')`
 * - isStub=true 让 CapabilityRegistry.resolve() 自动跳过
 *
 * 与旧版 VideoEngineAdapter 接口的差异:
 * - 旧版用对象方法(ffmpegEngine.compress(blob, params))
 * - 新版用独立纯函数(compressVideo(blob, params)),与 engine-pdf 一致
 * - 旧版 adapter 接口已移除(无外部消费方,plugin-video 已迁移)
 */

import type { VideoInfo } from './types.js';

/** 浏览器 stub 错误消息(统一格式) */
function stubMessage(operation: string): string {
  return (
    `${operation} not implemented in stub (browser engine-video). ` +
    `Use @lokvis/engine-video/node (Node + ffmpeg-static) for real operations.`
  );
}

/**
 * 压缩视频(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入视频 Blob
 * @param _params 压缩参数(format/bitrate/crf/scale)
 */
export async function compressVideo(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('compressVideo'));
}

/**
 * 转码视频(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入视频 Blob
 * @param _params 转码参数(format 必填 / codec / bitrate / crf)
 */
export async function transcodeVideo(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('transcodeVideo'));
}

/**
 * 裁剪视频片段(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入视频 Blob
 * @param _params 裁剪参数(start / end,单位秒)
 */
export async function trimVideo(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('trimVideo'));
}

/**
 * 合并多个视频(Blob[] → Blob)— 浏览器 stub。
 *
 * @param _blobs 输入视频 Blob 数组
 * @param _params 合并参数(format / transition)
 */
export async function mergeVideos(
  _blobs: Blob[],
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('mergeVideos'));
}

/**
 * 从视频提取音频轨(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入视频 Blob
 * @param _params 音频参数(format / bitrate)
 */
export async function extractAudio(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('extractAudio'));
}

/**
 * 将视频(或片段)转换为 GIF(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入视频 Blob
 * @param _params GIF 参数(start / end / fps / width)
 */
export async function toGif(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('toGif'));
}

/**
 * 视频截图(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入视频 Blob
 * @param _params 截图参数(time 必填 / format)
 */
export async function screenshotVideo(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('screenshotVideo'));
}

/**
 * 读取视频基本信息(分辨率/时长/帧率/编解码)— 浏览器 stub。
 *
 * @param _blob 输入视频 Blob
 */
export async function getVideoInfo(_blob: Blob): Promise<VideoInfo> {
  throw new Error(stubMessage('getVideoInfo'));
}

// ─── 类型重导出(供消费方 import 自本模块) ────────────────────
export type {
  VideoOutputFormat,
  VideoTranscodeParams,
  VideoTrimParams,
  VideoCompressParams,
  VideoMergeParams,
  VideoExtractAudioParams,
  VideoToGifParams,
  VideoScreenshotParams,
  VideoInfo,
} from './types.js';

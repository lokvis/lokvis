/**
 * Audio Blob↔Blob 操作(浏览器版,全 stub)
 *
 * 与 engine-video / engine-pdf 的 operations.ts 模式对齐:暴露独立操作的纯函数,
 * 供 plugin-audio 在 installer 中绑定到 capability。
 *
 * 浏览器版所有操作标记为 stub:
 * - 真实音频处理需要 Web Audio API 解码 + lamejs 编码(体积大,且跨容器
 *   支持有限),浏览器用户应通过 MCP Server(Node 端 ffmpeg-static)处理音频
 * - 真实 Node 端操作由 `@lokvis/engine-audio/node` 提供,经子路径导出
 *
 * AGENTS.md Stub Engine 约定:
 * - 所有 operation 方法抛出 `new Error('xxx not implemented in stub')`
 * - isStub=true 让 CapabilityRegistry.resolve() 自动跳过
 *
 * 与旧版 AudioEngineAdapter 接口的差异:
 * - 旧版用对象方法(webAudioEngine.trim(blob, params))
 * - 新版用独立纯函数(trimAudio(blob, params)),与 engine-video 一致
 * - 旧版 adapter 接口已移除(无外部消费方,plugin-audio 已迁移)
 */

/** 浏览器 stub 错误消息(统一格式) */
function stubMessage(operation: string): string {
  return (
    `${operation} not implemented in stub (browser engine-audio). ` +
    `Use @lokvis/engine-audio/node (Node + ffmpeg-static) for real operations.`
  );
}

/**
 * 裁剪音频片段(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入音频 Blob
 * @param _params 裁剪参数(start / end,单位秒)
 */
export async function trimAudio(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('trimAudio'));
}

/**
 * 合并多个音频(Blob[] → Blob)— 浏览器 stub。
 *
 * @param _blobs 输入音频 Blob 数组
 * @param _params 合并参数(format)
 */
export async function mergeAudios(
  _blobs: Blob[],
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('mergeAudios'));
}

/**
 * 音频转码(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入音频 Blob
 * @param _params 转码参数(format 必填 / bitrate)
 */
export async function transcodeAudio(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('transcodeAudio'));
}

/**
 * 音频标准化(Blob → Blob)— 浏览器 stub。
 *
 * @param _blob 输入音频 Blob
 * @param _params 标准化参数(level)
 */
export async function normalizeAudio(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(stubMessage('normalizeAudio'));
}

// ─── 类型重导出(供消费方 import 自本模块) ────────────────────
export type {
  AudioOutputFormat,
  AudioTrimParams,
  AudioMergeParams,
  AudioTranscodeParams,
  AudioNormalizeParams,
} from './types.js';

/**
 * Video Tools Plugin — 浏览器环境版本(基于 ffmpeg.wasm 引擎)
 *
 * 与默认入口 `videoToolsPlugin()`(全 stub)的区别:
 * - 默认入口所有 capability 标记为 stub,不加载 ffmpeg.wasm
 * - Web 版直接绑定 `@lokvis/engine-video/web` 的 Blob↔Blob 操作(7 真实)
 *
 * ffmpeg.wasm 经 engine-video/web 内部懒加载(首次操作时按需拉取 ~32MB),
 * 不会进入消费方首屏 bundle——仅在用户实际触发视频处理时加载。
 *
 * 7 个真实操作:
 * - video.compress(1→1):调整比特率/CRF/缩放
 * - video.transcode(1→1):转换容器/编解码
 * - video.trim(1→1):按时间范围截取
 * - video.merge(N→1):concat demuxer 合并
 * - video.extract-audio(1→1):提取音频轨
 * - video.to-gif(1→1):视频转 GIF(含调色板)
 * - video.screenshot(1→1):指定时间点截图
 *
 * 用途:
 * - @lokvis/embed-video 的 hooks 内部使用(浏览器端视频处理)
 * - 任何需要在浏览器端运行真实视频操作的消费方
 *
 * 通过子路径 `@lokvis/plugin-video/web` 导出:
 *   import { videoToolsPluginWeb } from '@lokvis/plugin-video/web';
 */
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  definePlugin,
} from '@lokvis/plugin-sdk';
import { VIDEO_CAPABILITIES } from '@lokvis/capability';
import type {
  AssetType,
  CapabilityImplementation,
  PluginContext,
} from '@lokvis/schema';
import {
  compressVideo,
  transcodeVideo,
  trimVideo,
  mergeVideos,
  extractAudio,
  toGif,
  screenshotVideo,
  VIDEO_ENGINE,
} from '@lokvis/engine-video/web';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';
import { deriveVideoMetadata } from './operations.js';

/** Web 引擎名(单一来源:engine-video/web 的 VIDEO_ENGINE 描述符) */
export const PLUGIN_ENGINE_WEB = VIDEO_ENGINE.name;

/** Web 端 stub 状态单点推导(AGENTS.md 约定:version 含 'stub') */
const isStub = VIDEO_ENGINE.version.includes('stub');

/** single 形态的 Blob→Blob 操作签名 */
type SingleVideoOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** merge 形态的 Blob[]→Blob 操作签名 */
type MergeVideoOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 1→1 能力绑定(与 operations.ts 的 VIDEO_OPERATION_ENTRIES 对齐) */
const SINGLE_ENTRIES: Array<{
  capability: string;
  outputType: AssetType;
  operation: SingleVideoOperation;
}> = [
  { capability: 'video.compress',      outputType: 'video', operation: compressVideo as SingleVideoOperation },
  { capability: 'video.transcode',     outputType: 'video', operation: transcodeVideo as SingleVideoOperation },
  { capability: 'video.trim',          outputType: 'video', operation: trimVideo as SingleVideoOperation },
  { capability: 'video.extract-audio', outputType: 'audio', operation: extractAudio as SingleVideoOperation },
  { capability: 'video.to-gif',        outputType: 'image', operation: toGif as SingleVideoOperation },
  { capability: 'video.screenshot',    outputType: 'image', operation: screenshotVideo as SingleVideoOperation },
];

/**
 * 创建视频工具插件(浏览器环境,基于 ffmpeg.wasm 引擎)
 *
 * 7 个真实操作(compress/transcode/trim/merge/extract-audio/to-gif/screenshot),
 * ffmpeg.wasm 按需懒加载,不影响首屏。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { videoToolsPluginWeb } from '@lokvis/plugin-video/web';
 *
 * const lokvis = await createLokvis({
 *   plugins: [videoToolsPluginWeb()],
 * });
 * ```
 */
export function videoToolsPluginWeb() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official video tools (browser, ffmpeg.wasm): compress / transcode / trim / merge / extract-audio / to-gif / screenshot',
      capabilities: VIDEO_CAPABILITIES,
      engine: PLUGIN_ENGINE_WEB,
      permissions: ['asset:read', 'asset:write', 'network:limited'],
    },
    (ctx: PluginContext) => {
      const impls: CapabilityImplementation[] = [];

      // ─── 6 个 single(1→1)操作 ────────────────────────────
      for (const entry of SINGLE_ENTRIES) {
        const derive = deriveVideoMetadata(entry.outputType);
        impls.push(
          createBlobCapabilityImpl(
            {
              capability: entry.capability,
              engine: PLUGIN_ENGINE_WEB,
              outputType: entry.outputType,
              operation: entry.operation,
              isStub,
              deriveMetadata: (_source, outBlob) => derive(outBlob),
            },
            ctx
          )
        );
      }

      // ─── merge(N→1)操作 ────────────────────────────────────
      const mergeDerive = deriveVideoMetadata('video');
      impls.push(
        createMergeCapabilityImpl(
          {
            capability: 'video.merge',
            engine: PLUGIN_ENGINE_WEB,
            outputType: 'video',
            operation: mergeVideos as MergeVideoOperation,
            isStub,
            deriveMetadata: mergeDerive,
          },
          ctx
        )
      );

      for (const impl of impls) {
        ctx.registerCapability(impl);
      }

      ctx.log(
        'info',
        `Registered ${impls.length} video capabilities (ffmpeg.wasm engine, browser, all real)`
      );
    }
  );
}

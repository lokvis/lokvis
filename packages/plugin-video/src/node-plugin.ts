/**
 * Video Tools Plugin — Node 环境版本(基于 ffmpeg-static 引擎)
 *
 * 与浏览器版本 `videoToolsPlugin()` 的区别:
 * - 浏览器版所有 capability 标记为 stub,运行时抛错(不加载 ffmpeg.wasm ~30MB)
 * - Node 版直接绑定 `@lokvis/engine-video/node` 的独立 Blob↔Blob 操作
 *   (compressVideo / transcodeVideo / trimVideo / mergeVideos / extractAudio /
 *    toGif / screenshotVideo,基于 ffmpeg-static),7 个真实能力 + 元数据 reader
 *
 * 7 个真实操作(全部实装):
 * - video.compress(1→1):compressVideo(Blob → Blob)
 * - video.transcode(1→1):transcodeVideo(Blob → Blob)
 * - video.trim(1→1):trimVideo(Blob → Blob)
 * - video.merge(N→1):mergeVideos(Blob[] → Blob)
 * - video.extract-audio(1→1):extractAudio(Blob → Blob)
 * - video.to-gif(1→1):toGif(Blob → Blob)
 * - video.screenshot(1→1):screenshotVideo(Blob → Blob)
 *
 * 用途:
 * - MCP Server(Node 端 video tool 实际执行器)
 * - 让 mcp-server 的 video tool 经 runtime.run() 走完整 capability 系统
 *   (与 image / pdf tool 模式一致)
 *
 * 通过子路径 `@lokvis/plugin-video/node` 导出,与 plugin-image/node / plugin-pdf/node
 * 模式一致,避免浏览器构建误加载 ffmpeg-static 二进制:
 *   import { videoToolsPluginNode } from '@lokvis/plugin-video/node';
 */
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  definePlugin,
} from '@lokvis/plugin-sdk';
import { VIDEO_CAPABILITIES } from '@lokvis/capability';
import type {
  AssetMetadata,
  AssetType,
  VideoInfo,
} from '@lokvis/schema';
import {
  compressVideo as opCompressVideo,
  transcodeVideo as opTranscodeVideo,
  trimVideo as opTrimVideo,
  mergeVideos as opMergeVideos,
  extractAudio as opExtractAudio,
  toGif as opToGif,
  screenshotVideo as opScreenshotVideo,
  getVideoInfo,
} from '@lokvis/engine-video/node';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';

/** Node 引擎名(底层为 ffmpeg-static,与浏览器版 'ffmpeg-wasm' 区分) */
export const PLUGIN_ENGINE_NODE = 'ffmpeg-static' as const;

/** 元数据读取器名称(视频分辨率/时长/帧率查询,走 MetadataReader 机制) */
export const VIDEO_INFO_READER_NAME = 'video.read-info';

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

/** 从输出 Blob 派生 video/audio/image 类型 Asset 元数据 */
function deriveVideoMetadata(outputType: AssetType): (outBlob: Blob) => AssetMetadata {
  return (outBlob: Blob) => {
    let fallback: { mimeType: string; format: string };
    switch (outputType) {
      case 'video':
        fallback = { mimeType: 'video/mp4', format: 'mp4' };
        break;
      case 'audio':
        fallback = { mimeType: 'audio/mpeg', format: 'mp3' };
        break;
      case 'image':
        fallback = { mimeType: 'image/png', format: 'png' };
        break;
      default:
        fallback = { mimeType: 'application/octet-stream', format: 'bin' };
    }
    const mimeType = outBlob.type || fallback.mimeType;
    const format = mimeType.split('/')[1] ?? fallback.format;
    return { mimeType, size: outBlob.size, format };
  };
}

/**
 * 创建视频工具插件(Node 环境,基于 ffmpeg-static 引擎)
 *
 * 7 真实 capability(compress / transcode / trim / merge / extract-audio /
 * to-gif / screenshot)+ 1 个 MetadataReader(video.read-info,返回 VideoInfo)。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { videoToolsPluginNode } from '@lokvis/plugin-video/node';
 *
 * const lokvis = await createLokvis({
 *   plugins: [await videoToolsPluginNode()],
 * });
 * ```
 *
 * 注:本函数为 async,与 imageToolsPluginNode / pdfToolsPluginNode 对齐,
 * 保留未来引擎初始化(如 ffmpeg 路径探测)的扩展点。
 */
export async function videoToolsPluginNode() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official video tools (Node, ffmpeg-static): compress / transcode / trim / merge / extract-audio / to-gif / screenshot',
      capabilities: VIDEO_CAPABILITIES,
      engine: PLUGIN_ENGINE_NODE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 7 个能力实现:全部真实(无 stub)
      const impls = [
        // ─── 1→1 形态(createBlobCapabilityImpl) ────────────────
        // video.compress: 1→1,outputType='video'
        createBlobCapabilityImpl(
          {
            capability: 'video.compress',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'video' as AssetType,
            operation: opCompressVideo as SingleVideoOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => deriveVideoMetadata('video')(outBlob),
          },
          ctx
        ),
        // video.transcode: 1→1,outputType='video'
        createBlobCapabilityImpl(
          {
            capability: 'video.transcode',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'video' as AssetType,
            operation: opTranscodeVideo as SingleVideoOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => deriveVideoMetadata('video')(outBlob),
          },
          ctx
        ),
        // video.trim: 1→1,outputType='video'
        createBlobCapabilityImpl(
          {
            capability: 'video.trim',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'video' as AssetType,
            operation: opTrimVideo as SingleVideoOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => deriveVideoMetadata('video')(outBlob),
          },
          ctx
        ),
        // video.extract-audio: 1→1,outputType='audio'
        createBlobCapabilityImpl(
          {
            capability: 'video.extract-audio',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'audio' as AssetType,
            operation: opExtractAudio as SingleVideoOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => deriveVideoMetadata('audio')(outBlob),
          },
          ctx
        ),
        // video.to-gif: 1→1,outputType='image'
        createBlobCapabilityImpl(
          {
            capability: 'video.to-gif',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'image' as AssetType,
            operation: opToGif as SingleVideoOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => deriveVideoMetadata('image')(outBlob),
          },
          ctx
        ),
        // video.screenshot: 1→1,outputType='image'
        createBlobCapabilityImpl(
          {
            capability: 'video.screenshot',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'image' as AssetType,
            operation: opScreenshotVideo as SingleVideoOperation,
            isStub: false,
            deriveMetadata: (_source, outBlob) => deriveVideoMetadata('image')(outBlob),
          },
          ctx
        ),

        // ─── N→1 形态(createMergeCapabilityImpl) ────────────────
        // video.merge: N→1,outputType='video'
        createMergeCapabilityImpl(
          {
            capability: 'video.merge',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'video' as AssetType,
            operation: opMergeVideos as MergeVideoOperation,
            isStub: false,
            deriveMetadata: deriveVideoMetadata('video'),
          },
          ctx
        ),
      ];

      for (const impl of impls) {
        ctx.registerCapability(impl);
      }

      // 视频元数据查询 reader(供 mcp-server 报告处理结果分辨率/时长/帧率)。
      // 内部调 engine-video/node 的 getVideoInfo(ffprobe 解析),
      // 走 MetadataReader 机制避免上层(mcp-server)直接依赖 engine-video。
      ctx.registerMetadataReader<VideoInfo>(
        VIDEO_INFO_READER_NAME,
        async (asset, readerCtx) => {
          const blob = await ctx.runtime.getAssetBlob(asset);
          try {
            return await getVideoInfo(blob);
          } catch (err) {
            // 解析失败与"无数据"区分:warn 上报,返回 null 不影响主流程
            readerCtx.log('warn', `getVideoInfo failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }
      );

      ctx.log(
        'info',
        `Registered ${impls.length} video capabilities (ffmpeg-static engine, all real) + video info reader`
      );
    }
  );
}

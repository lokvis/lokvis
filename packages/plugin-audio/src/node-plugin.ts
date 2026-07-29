/**
 * Audio Tools Plugin — Node 环境版本(基于 ffmpeg-static 引擎)
 *
 * 与浏览器版本 `audioToolsPlugin()` 的区别:
 * - 浏览器版所有 capability 标记为 stub,运行时抛错(不加载 ffmpeg.wasm)
 * - Node 版直接绑定 `@lokvis/engine-audio/node` 的独立 Blob↔Blob 操作
 *   (trimAudio / mergeAudios / transcodeAudio / normalizeAudio,基于 ffmpeg-static),
 *   4 个真实能力
 *
 * 4 个真实操作(全部实装):
 * - audio.trim(1→1):trimAudio(Blob → Blob)
 * - audio.normalize(1→1):normalizeAudio(Blob → Blob)
 * - audio.transcode(1→1):transcodeAudio(Blob → Blob)
 * - audio.merge(N→1):mergeAudios(Blob[] → Blob)
 *
 * 用途:
 * - MCP Server(Node 端 audio tool 实际执行器)
 * - 让 mcp-server 的 audio tool 经 runtime.run() 走完整 capability 系统
 *   (与 image / pdf / video tool 模式一致)
 *
 * 通过子路径 `@lokvis/plugin-audio/node` 导出,与 plugin-image/node /
 * plugin-pdf/node / plugin-video/node 模式一致,避免浏览器构建误加载
 * ffmpeg-static 二进制:
 *   import { audioToolsPluginNode } from '@lokvis/plugin-audio/node';
 */
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  definePlugin,
} from '@lokvis/plugin-sdk';
import { AUDIO_CAPABILITIES } from '@lokvis/capability';
import {
  trimAudio as opTrimAudio,
  normalizeAudio as opNormalizeAudio,
  transcodeAudio as opTranscodeAudio,
  mergeAudios as opMergeAudios,
  AUDIO_ENGINE,
} from '@lokvis/engine-audio/node';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';
import { deriveAudioMetadata } from './operations.js';

/** Node 引擎名(单一来源:engine-audio/node 的 AUDIO_ENGINE 描述符) */
export const PLUGIN_ENGINE_NODE = AUDIO_ENGINE.name;

/** Node 端 stub 状态单点推导(AGENTS.md 约定:version 含 'stub') */
const isStub = AUDIO_ENGINE.version.includes('stub');

/** single 形态的 Blob→Blob 操作签名 */
type SingleAudioOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** merge 形态的 Blob[]→Blob 操作签名 */
type MergeAudioOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/**
 * 创建音频工具插件(Node 环境,基于 ffmpeg-static 引擎)
 *
 * 4 真实 capability(trim / normalize / transcode / merge)。
 *
 * @example
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { audioToolsPluginNode } from '@lokvis/plugin-audio/node';
 *
 * const lokvis = await createLokvis({
 *   plugins: [await audioToolsPluginNode()],
 * });
 * ```
 *
 * 注:本函数为 async,与 imageToolsPluginNode / pdfToolsPluginNode /
 * videoToolsPluginNode 对齐,保留未来引擎初始化(如 ffmpeg 路径探测)的扩展点。
 */
export async function audioToolsPluginNode() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official audio tools (Node, ffmpeg-static): trim / normalize / merge / transcode',
      capabilities: AUDIO_CAPABILITIES,
      engine: PLUGIN_ENGINE_NODE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // 4 个能力实现:全部真实(无 stub)
      const impls = [
        // ─── 1→1 形态(createBlobCapabilityImpl) ────────────────
        // audio.trim: 1→1,outputType='audio'
        createBlobCapabilityImpl(
          {
            capability: 'audio.trim',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'audio',
            operation: opTrimAudio as SingleAudioOperation,
            isStub,
            deriveMetadata: (_source, outBlob) => deriveAudioMetadata(outBlob),
          },
          ctx
        ),
        // audio.normalize: 1→1,outputType='audio'
        createBlobCapabilityImpl(
          {
            capability: 'audio.normalize',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'audio',
            operation: opNormalizeAudio as SingleAudioOperation,
            isStub,
            deriveMetadata: (_source, outBlob) => deriveAudioMetadata(outBlob),
          },
          ctx
        ),
        // audio.transcode: 1→1,outputType='audio'
        createBlobCapabilityImpl(
          {
            capability: 'audio.transcode',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'audio',
            operation: opTranscodeAudio as SingleAudioOperation,
            isStub,
            deriveMetadata: (_source, outBlob) => deriveAudioMetadata(outBlob),
          },
          ctx
        ),

        // ─── N→1 形态(createMergeCapabilityImpl) ────────────────
        // audio.merge: N→1,outputType='audio'
        createMergeCapabilityImpl(
          {
            capability: 'audio.merge',
            engine: PLUGIN_ENGINE_NODE,
            outputType: 'audio',
            operation: opMergeAudios as MergeAudioOperation,
            isStub,
            deriveMetadata: deriveAudioMetadata,
          },
          ctx
        ),
      ];

      for (const impl of impls) {
        ctx.registerCapability(impl);
      }

      ctx.log(
        'info',
        `Registered ${impls.length} audio capabilities (ffmpeg-static engine, all real)`
      );
    }
  );
}

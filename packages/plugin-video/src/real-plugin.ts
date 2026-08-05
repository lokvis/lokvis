/**
 * Video Tools Plugin — Node/Web 共享实现(基于 ffmpeg-static / ffmpeg.wasm 引擎)
 *
 * node-plugin.ts 与 web-plugin.ts 的实现此前 ~90% 重复,仅引擎来源和环境文案不同。
 * 本模块抽取共享骨架:7 个 capability 绑定(6 single + 1 merge)、VideoInfo 读取器、
 * info 日志,由 buildRealVideoPlugin(options, ops) 一次性构造。
 *
 * 与默认入口 `videoToolsPlugin()`(全 stub、engine-free)的区别:
 * 本模块 import `@lokvis/engine-video/node` 或 `/web`,故仅供子路径使用。
 */
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  definePlugin,
  deriveOutputMetadata,
  deriveOutputMetadataWithSource,
  registerImplementations,
} from '@lokvis/plugin-sdk';
import { VIDEO_CAPABILITIES } from '@lokvis/capability';
import type { AssetType, VideoInfo } from '@lokvis/schema';
import { METADATA_READER_NAMES } from '@lokvis/schema';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';

/** 元数据读取器名称(单一来源:@lokvis/schema METADATA_READER_NAMES) */
export const VIDEO_INFO_READER_NAME = METADATA_READER_NAMES.videoInfo;

/** single 形态的 Blob→Blob 操作签名 */
export type SingleVideoOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** merge 形态的 Blob[]→Blob 操作签名 */
export type MergeVideoOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 带 kind 判别式的统一绑定项 */
interface RealVideoEntry {
  capability: string;
  kind: 'single' | 'merge';
  outputType: AssetType;
  operation: SingleVideoOperation | MergeVideoOperation;
}

/** buildRealVideoPlugin 的环境相关参数 */
export interface RealVideoPluginOptions {
  /** 引擎名(如 VIDEO_ENGINE.name) */
  engineName: string;
  /** 日志中的引擎描述,如 "ffmpeg-static engine" / "ffmpeg.wasm engine" */
  logEngineDesc: string;
  /** 权限列表(Node: network:none, Web: network:limited) */
  permissions: Array<'asset:read' | 'asset:write' | 'network:none' | 'network:limited'>;
}

/** 操作函数集合(由 node/web 入口传入) */
export interface RealVideoOperations {
  compress: SingleVideoOperation;
  transcode: SingleVideoOperation;
  trim: SingleVideoOperation;
  extractAudio: SingleVideoOperation;
  toGif: SingleVideoOperation;
  screenshot: SingleVideoOperation;
  merge: MergeVideoOperation;
  getVideoInfo: (blob: Blob) => Promise<VideoInfo>;
}

/** 7 个真实操作绑定项(6 single + 1 merge) */
function realVideoEntries(ops: RealVideoOperations): RealVideoEntry[] {
  return [
    { capability: 'video.compress', kind: 'single', outputType: 'video', operation: ops.compress },
    { capability: 'video.transcode', kind: 'single', outputType: 'video', operation: ops.transcode },
    { capability: 'video.trim', kind: 'single', outputType: 'video', operation: ops.trim },
    { capability: 'video.extract-audio', kind: 'single', outputType: 'audio', operation: ops.extractAudio },
    { capability: 'video.to-gif', kind: 'single', outputType: 'image', operation: ops.toGif },
    { capability: 'video.screenshot', kind: 'single', outputType: 'image', operation: ops.screenshot },
    { capability: 'video.merge', kind: 'merge', outputType: 'video', operation: ops.merge },
  ];
}

/**
 * 构造真实视频工具插件(Node/Web 共享)。
 *
 * 7 个真实能力(compress / transcode / trim / merge / extract-audio / to-gif / screenshot)
 * + VideoInfo reader。
 */
export function buildRealVideoPlugin(
  options: RealVideoPluginOptions,
  ops: RealVideoOperations
) {
  const { engineName, logEngineDesc, permissions } = options;
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official video tools (ffmpeg): compress / transcode / trim / merge / extract-audio / to-gif / screenshot',
      capabilities: VIDEO_CAPABILITIES,
      engine: engineName,
      permissions,
    },
    (ctx) => {
      const entries = realVideoEntries(ops);
      const impls = entries.map((entry) => {
        switch (entry.kind) {
          case 'single':
            return createBlobCapabilityImpl(
              {
                capability: entry.capability,
                engine: engineName,
                outputType: entry.outputType,
                operation: entry.operation as SingleVideoOperation,
                isStub: false,
                deriveMetadata: deriveOutputMetadataWithSource(entry.outputType),
              },
              ctx
            );
          case 'merge':
            return createMergeCapabilityImpl(
              {
                capability: entry.capability,
                engine: engineName,
                outputType: entry.outputType,
                operation: entry.operation as MergeVideoOperation,
                isStub: false,
                deriveMetadata: deriveOutputMetadata(entry.outputType),
              },
              ctx
            );
        }
      });

      registerImplementations(ctx, impls);

      // 视频元数据查询 reader(供 mcp-server 报告处理结果分辨率/时长/帧率)
      ctx.registerMetadataReader<VideoInfo>(
        VIDEO_INFO_READER_NAME,
        async (asset, readerCtx) => {
          const blob = await ctx.runtime.getAssetBlob(asset);
          try {
            return await ops.getVideoInfo(blob);
          } catch (err) {
            readerCtx.log('warn', `getVideoInfo failed: ${err instanceof Error ? err.message : String(err)}`);
            return null;
          }
        }
      );

      ctx.log(
        'info',
        `Registered ${impls.length} video capabilities (${logEngineDesc}, all real) + video info reader`
      );
    }
  );
}

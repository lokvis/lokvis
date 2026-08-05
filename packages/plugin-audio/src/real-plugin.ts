/**
 * Audio Tools Plugin — Node 共享实现(基于 ffmpeg-static 引擎)
 *
 * node-plugin.ts 的实现此前与 operations.ts ~90% 重复,仅引擎来源不同。
 * 本模块抽取共享骨架:4 个 capability 绑定(3 single + 1 merge)、info 日志,
 * 由 buildRealAudioPlugin(options, ops) 一次性构造。
 *
 * 与默认入口 `audioToolsPlugin()`(全 stub、engine-free)的区别:
 * 本模块 import `@lokvis/engine-audio/node`,故仅供 `/node` 子路径使用。
 */
import {
  createBlobCapabilityImpl,
  createMergeCapabilityImpl,
  definePlugin,
  deriveOutputMetadata,
  deriveOutputMetadataWithSource,
  registerImplementations,
} from '@lokvis/plugin-sdk';
import { AUDIO_CAPABILITIES } from '@lokvis/capability';
import type { AssetType } from '@lokvis/schema';
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin.js';

/** single 形态的 Blob→Blob 操作签名 */
export type SingleAudioOperation = (
  blob: Blob,
  params: Record<string, unknown>
) => Promise<Blob>;

/** merge 形态的 Blob[]→Blob 操作签名 */
export type MergeAudioOperation = (
  blobs: Blob[],
  params: Record<string, unknown>
) => Promise<Blob>;

/** 带 kind 判别式的统一绑定项 */
interface RealAudioEntry {
  capability: string;
  kind: 'single' | 'merge';
  outputType: AssetType;
  operation: SingleAudioOperation | MergeAudioOperation;
}

/** buildRealAudioPlugin 的环境相关参数 */
export interface RealAudioPluginOptions {
  /** 引擎名(如 AUDIO_ENGINE.name) */
  engineName: string;
  /** 日志中的引擎描述,如 "ffmpeg-static engine" */
  logEngineDesc: string;
}

/** 操作函数集合(由 node 入口传入) */
export interface RealAudioOperations {
  trim: SingleAudioOperation;
  normalize: SingleAudioOperation;
  transcode: SingleAudioOperation;
  merge: MergeAudioOperation;
}

/** 4 个真实操作绑定项(3 single + 1 merge) */
function realAudioEntries(ops: RealAudioOperations): RealAudioEntry[] {
  return [
    { capability: 'audio.trim', kind: 'single', outputType: 'audio', operation: ops.trim },
    { capability: 'audio.normalize', kind: 'single', outputType: 'audio', operation: ops.normalize },
    { capability: 'audio.transcode', kind: 'single', outputType: 'audio', operation: ops.transcode },
    { capability: 'audio.merge', kind: 'merge', outputType: 'audio', operation: ops.merge },
  ];
}

/**
 * 构造真实音频工具插件(Node 共享)。
 *
 * 4 个真实能力(trim / normalize / transcode / merge)。
 */
export function buildRealAudioPlugin(
  options: RealAudioPluginOptions,
  ops: RealAudioOperations
) {
  const { engineName, logEngineDesc } = options;
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Official audio tools (ffmpeg-static): trim / normalize / merge / transcode',
      capabilities: AUDIO_CAPABILITIES,
      engine: engineName,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const entries = realAudioEntries(ops);
      const impls = entries.map((entry) => {
        switch (entry.kind) {
          case 'single':
            return createBlobCapabilityImpl(
              {
                capability: entry.capability,
                engine: engineName,
                outputType: entry.outputType,
                operation: entry.operation as SingleAudioOperation,
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
                operation: entry.operation as MergeAudioOperation,
                isStub: false,
                deriveMetadata: deriveOutputMetadata(entry.outputType),
              },
              ctx
            );
        }
      });

      registerImplementations(ctx, impls);

      ctx.log(
        'info',
        `Registered ${impls.length} audio capabilities (${logEngineDesc}, all real)`
      );
    }
  );
}

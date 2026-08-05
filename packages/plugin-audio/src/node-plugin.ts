/**
 * Audio Tools Plugin — Node 环境版本(基于 ffmpeg-static 引擎)
 *
 * 通过子路径 `@lokvis/plugin-audio/node` 导出:
 *   import { audioToolsPluginNode } from '@lokvis/plugin-audio/node';
 *
 * 本文件为 thin wrapper,实际逻辑由 real-plugin.ts 的 buildRealAudioPlugin 处理。
 */
import {
  trimAudio as opTrimAudio,
  normalizeAudio as opNormalizeAudio,
  transcodeAudio as opTranscodeAudio,
  mergeAudios as opMergeAudios,
  AUDIO_ENGINE,
} from '@lokvis/engine-audio/node';
import { buildRealAudioPlugin } from './real-plugin.js';
import type { SingleAudioOperation, MergeAudioOperation } from './real-plugin.js';

/** Node 引擎名(单一来源:engine-audio/node 的 AUDIO_ENGINE 描述符) */
export const PLUGIN_ENGINE_NODE = AUDIO_ENGINE.name;

/**
 * 创建音频工具插件(Node 环境,基于 ffmpeg-static 引擎)
 *
 * 4 真实 capability(trim / normalize / transcode / merge)。
 */
export async function audioToolsPluginNode() {
  return buildRealAudioPlugin(
    {
      engineName: PLUGIN_ENGINE_NODE,
      logEngineDesc: 'ffmpeg-static engine',
    },
    {
      trim: opTrimAudio as SingleAudioOperation,
      normalize: opNormalizeAudio as SingleAudioOperation,
      transcode: opTranscodeAudio as SingleAudioOperation,
      merge: opMergeAudios as MergeAudioOperation,
    }
  );
}

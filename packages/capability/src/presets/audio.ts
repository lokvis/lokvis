/**
 * 音频能力预设
 *
 * 4 个标准音频能力声明:trim / normalize / merge / transcode。
 * 仅桥接 engine-audio 已声明的 supportedCapabilities,不新增 denoise
 * 等 engine 尚未声明的能力(见 W3.1 任务范围"不做"条款)。
 *
 * 引擎对应关系(engine-audio):
 * - webAudioEngine:  trim / normalize / merge
 * - lamejsEngine:    transcode
 */
import type { Capability } from '@lokvis/schema';

export const AUDIO_TRIM: Capability = {
  name: 'audio.trim',
  description: 'Trim audio to a time range',
  inputTypes: ['audio'],
  outputTypes: ['audio'],
  params: [
    { name: 'start', type: 'number', required: true, min: 0, description: 'Start time in seconds' },
    { name: 'end', type: 'number', required: true, min: 0, description: 'End time in seconds' },
  ],
  performance: 'medium',
  batchable: true,
};

export const AUDIO_NORMALIZE: Capability = {
  name: 'audio.normalize',
  description: 'Normalize audio loudness to a target level',
  inputTypes: ['audio'],
  outputTypes: ['audio'],
  params: [
    { name: 'level', type: 'number', required: false, description: 'Target loudness in dB' },
  ],
  performance: 'medium',
  batchable: true,
};

export const AUDIO_MERGE: Capability = {
  name: 'audio.merge',
  description: 'Merge multiple audio clips into one',
  inputTypes: ['audio'],
  outputTypes: ['audio'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['mp3', 'wav', 'ogg', 'aac'],
      default: 'mp3',
      description: 'Output audio format',
    },
  ],
  performance: 'slow',
  batchable: false,
};

export const AUDIO_TRANSCODE: Capability = {
  name: 'audio.transcode',
  description: 'Transcode audio to another format / codec',
  inputTypes: ['audio'],
  outputTypes: ['audio'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['mp3', 'wav', 'ogg', 'aac'],
      required: true,
      description: 'Target audio format',
    },
    { name: 'bitrate', type: 'number', required: false, min: 0, description: 'Target bitrate in bps' },
  ],
  performance: 'slow',
  batchable: true,
};

/** 所有内置音频能力预设 */
export const AUDIO_CAPABILITIES: Capability[] = [
  AUDIO_TRIM,
  AUDIO_NORMALIZE,
  AUDIO_MERGE,
  AUDIO_TRANSCODE,
];

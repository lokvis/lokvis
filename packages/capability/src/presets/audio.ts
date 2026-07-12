/**
 * 音频能力预设
 *
 * 5 个标准音频能力声明:trim / normalize / denoise / transcode / merge。
 * 名字常量见 names.ts(CAPABILITY_NAMES.AUDIO_*),engine 适配见
 * @lokvis/engine-audio(Web Audio API + lamejs,当前为 stub 实现)。
 *
 * W14.5 open 侧交付 §2.1:补齐 AUDIO 域 preset,解除 seed #8 Podcast
 * workflow 的兼容性校验阻塞。
 */
import type { Capability } from '@lokvis/schema';

/** 音频输出格式枚举(与 engine-audio AudioOutputFormat 对齐) */
const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'aac'] as const;

export const AUDIO_TRIM: Capability = {
  name: 'audio.trim',
  description: 'Trim audio to a time range',
  inputTypes: ['audio'],
  outputTypes: ['audio'],
  params: [
    { name: 'start', type: 'number', required: true, min: 0, description: 'Start time in seconds' },
    { name: 'end', type: 'number', required: true, min: 0, description: 'End time in seconds' },
  ],
  performance: 'fast',
  batchable: true,
};

export const AUDIO_NORMALIZE: Capability = {
  name: 'audio.normalize',
  description: 'Normalize audio loudness to a target level',
  inputTypes: ['audio'],
  outputTypes: ['audio'],
  params: [
    {
      name: 'level',
      type: 'number',
      required: false,
      default: -23,
      description: 'Target loudness in dB (EBU R128 LUFS, e.g. -23 for broadcast)',
    },
  ],
  performance: 'medium',
  batchable: true,
};

export const AUDIO_DENOISE: Capability = {
  name: 'audio.denoise',
  description: 'Reduce background noise from audio',
  inputTypes: ['audio'],
  outputTypes: ['audio'],
  params: [
    {
      name: 'strength',
      type: 'number',
      min: 0,
      max: 1,
      default: 0.5,
      description: 'Denoise strength (0=none, 1=aggressive)',
    },
  ],
  performance: 'slow',
  batchable: true,
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
      values: [...AUDIO_FORMATS],
      required: true,
      description: 'Target audio format',
    },
    { name: 'bitrate', type: 'number', required: false, min: 0, description: 'Target bitrate in bps' },
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
      values: [...AUDIO_FORMATS],
      default: 'mp3',
      description: 'Output audio format',
    },
  ],
  performance: 'medium',
  batchable: false,
};

/** 所有内置音频能力预设 */
export const AUDIO_CAPABILITIES: Capability[] = [
  AUDIO_TRIM,
  AUDIO_NORMALIZE,
  AUDIO_DENOISE,
  AUDIO_TRANSCODE,
  AUDIO_MERGE,
];

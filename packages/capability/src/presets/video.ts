/**
 * 视频能力预设
 *
 * 7 个标准视频能力声明:compress / transcode / trim / merge / extract-audio /
 * to-gif / screenshot。后续 W3 streaming 改造可能扩展参数。
 */
import type { Capability } from '@lokvis/schema';

export const VIDEO_COMPRESS: Capability = {
  name: 'video.compress',
  description: 'Compress video with specified bitrate / crf / scale',
  inputTypes: ['video'],
  outputTypes: ['video'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['mp4', 'webm'],
      default: 'mp4',
      description: 'Output container format',
    },
    { name: 'bitrate', type: 'number', required: false, min: 0, description: 'Target bitrate in bps' },
    { name: 'crf', type: 'number', required: false, min: 0, max: 51, description: 'Constant Rate Factor (0=lossless, 51=worst)' },
    { name: 'scale', type: 'number', required: false, min: 0, max: 1, description: 'Scale factor (0-1) applied to resolution' },
  ],
  performance: 'slow',
  batchable: true,
};

export const VIDEO_TRANSCODE: Capability = {
  name: 'video.transcode',
  description: 'Transcode video to another format / codec',
  inputTypes: ['video'],
  outputTypes: ['video'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['mp4', 'webm', 'gif'],
      required: true,
      description: 'Target container format',
    },
    { name: 'codec', type: 'string', required: false, description: 'Target codec name (e.g. libx264, vp9)' },
    { name: 'bitrate', type: 'number', required: false, min: 0, description: 'Target bitrate in bps' },
    { name: 'crf', type: 'number', required: false, min: 0, max: 51, description: 'Constant Rate Factor' },
  ],
  performance: 'slow',
  batchable: true,
};

export const VIDEO_TRIM: Capability = {
  name: 'video.trim',
  description: 'Trim video to a time range',
  inputTypes: ['video'],
  outputTypes: ['video'],
  params: [
    { name: 'start', type: 'number', required: true, min: 0, description: 'Start time in seconds' },
    { name: 'end', type: 'number', required: true, min: 0, description: 'End time in seconds' },
  ],
  performance: 'medium',
  batchable: true,
};

export const VIDEO_MERGE: Capability = {
  name: 'video.merge',
  description: 'Merge multiple video clips into one',
  inputTypes: ['video'],
  outputTypes: ['video'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['mp4', 'webm'],
      default: 'mp4',
      description: 'Output container format',
    },
  ],
  performance: 'slow',
  batchable: false,
};

export const VIDEO_EXTRACT_AUDIO: Capability = {
  name: 'video.extract-audio',
  description: 'Extract audio track from video',
  inputTypes: ['video'],
  outputTypes: ['audio'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['mp3', 'aac', 'wav'],
      default: 'mp3',
      description: 'Output audio format',
    },
  ],
  performance: 'slow',
  batchable: true,
};

export const VIDEO_TO_GIF: Capability = {
  name: 'video.to-gif',
  description: 'Convert video (or a segment) to animated GIF',
  inputTypes: ['video'],
  outputTypes: ['image'],
  params: [
    { name: 'fps', type: 'number', required: false, min: 1, default: 15, description: 'Frame rate of the GIF' },
    { name: 'width', type: 'number', required: false, min: 1, description: 'Output width in pixels' },
    { name: 'start', type: 'number', required: false, min: 0, description: 'Start time in seconds' },
    { name: 'end', type: 'number', required: false, min: 0, description: 'End time in seconds' },
  ],
  performance: 'slow',
  batchable: true,
};

export const VIDEO_SCREENSHOT: Capability = {
  name: 'video.screenshot',
  description: 'Capture a frame from video at a given timestamp',
  inputTypes: ['video'],
  outputTypes: ['image'],
  params: [
    { name: 'time', type: 'number', required: true, min: 0, description: 'Timestamp in seconds' },
    {
      name: 'format',
      type: 'enum',
      values: ['png', 'jpeg', 'webp'],
      default: 'png',
      description: 'Output image format',
    },
  ],
  performance: 'medium',
  batchable: true,
};

/** 所有内置视频能力预设 */
export const VIDEO_CAPABILITIES: Capability[] = [
  VIDEO_COMPRESS,
  VIDEO_TRANSCODE,
  VIDEO_TRIM,
  VIDEO_MERGE,
  VIDEO_EXTRACT_AUDIO,
  VIDEO_TO_GIF,
  VIDEO_SCREENSHOT,
];

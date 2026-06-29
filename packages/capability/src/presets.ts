/**
 * 内置能力声明预设
 *
 * 这些是官方推荐的标准能力定义，Plugin 作者可以直接引用，也可以自定义。
 * 标准化能力名有助于 Marketplace 搜索、Workflow 跨插件复用和 AI 生成 Workflow。
 */

import type { Capability } from '@lokvis/schema';

// ─── Image ────────────────────────────────────────────────

export const IMAGE_RESIZE: Capability = {
  name: 'image.resize',
  description: 'Resize image to specified dimensions',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'width', type: 'number', required: false, min: 1, description: 'Target width in pixels' },
    { name: 'height', type: 'number', required: false, min: 1, description: 'Target height in pixels' },
    {
      name: 'fit',
      type: 'enum',
      values: ['cover', 'contain', 'fill', 'inside', 'outside'],
      default: 'cover',
      description: 'Fit strategy when aspect ratio differs',
    },
    { name: 'maintainAspectRatio', type: 'boolean', default: true },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_COMPRESS: Capability = {
  name: 'image.compress',
  description: 'Compress image with specified quality',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['webp', 'avif', 'jpeg', 'png'],
      default: 'webp',
    },
    { name: 'quality', type: 'number', min: 0, max: 100, default: 85 },
    { name: 'targetSize', type: 'number', required: false, description: 'Target size in bytes (optional)' },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_CONVERT: Capability = {
  name: 'image.convert',
  description: 'Convert image to another format',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['png', 'jpeg', 'webp', 'avif', 'gif'],
      required: true,
    },
    { name: 'quality', type: 'number', min: 0, max: 100, default: 90 },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_CROP: Capability = {
  name: 'image.crop',
  description: 'Crop image to a region',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'x', type: 'number', required: true, min: 0 },
    { name: 'y', type: 'number', required: true, min: 0 },
    { name: 'width', type: 'number', required: true, min: 1 },
    { name: 'height', type: 'number', required: true, min: 1 },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_ROTATE: Capability = {
  name: 'image.rotate',
  description: 'Rotate image by degrees',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'angle', type: 'number', required: true, description: 'Rotation angle in degrees' },
    { name: 'background', type: 'color', default: '#ffffff' },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_FLIP: Capability = {
  name: 'image.flip',
  description: 'Flip image horizontally or vertically',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'axis',
      type: 'enum',
      values: ['horizontal', 'vertical', 'both'],
      required: true,
    },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_WATERMARK: Capability = {
  name: 'image.watermark',
  description: 'Add text or image watermark',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'text', type: 'string', required: false, description: 'Text watermark' },
    { name: 'image', type: 'file', required: false, description: 'Image watermark (data URL)' },
    {
      name: 'position',
      type: 'enum',
      values: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'tile'],
      default: 'bottom-right',
    },
    { name: 'opacity', type: 'number', min: 0, max: 1, default: 0.8 },
    { name: 'fontSize', type: 'number', default: 24 },
    { name: 'color', type: 'color', default: '#ffffff' },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_BACKGROUND: Capability = {
  name: 'image.background',
  description: 'Set background color (for transparent images)',
  inputTypes: ['image'],
  outputTypes: ['image'],
 params: [{ name: 'color', type: 'color', default: '#ffffff' }],
  performance: 'fast',
  batchable: true,
};

// ─── PDF ──────────────────────────────────────────────────

export const PDF_MERGE: Capability = {
  name: 'pdf.merge',
  description: 'Merge multiple PDF files into one',
  inputTypes: ['pdf'],
  outputTypes: ['pdf'],
  params: [],
  performance: 'medium',
  batchable: false,
};

export const PDF_SPLIT: Capability = {
  name: 'pdf.split',
  description: 'Split a PDF into multiple files by page count or ranges',
  inputTypes: ['pdf'],
  outputTypes: ['data'],
  params: [
    { name: 'pagesPerFile', type: 'number', required: false, min: 1, description: '每个输出文件包含的页数' },
    { name: 'ranges', type: 'array', items: 'number', required: false, description: '页码范围，如 [[1,3],[4,6]]' },
  ],
  performance: 'medium',
  batchable: true,
};

export const PDF_COMPRESS: Capability = {
  name: 'pdf.compress',
  description: 'Compress a PDF to reduce file size',
  inputTypes: ['pdf'],
  outputTypes: ['pdf'],
  params: [
    { name: 'level', type: 'number', min: 0, max: 9, default: 6, description: '压缩级别 (0-9)' },
  ],
  performance: 'medium',
  batchable: true,
};

export const PDF_ROTATE: Capability = {
  name: 'pdf.rotate',
  description: 'Rotate pages of a PDF by 90/180/270 degrees',
  inputTypes: ['pdf'],
  outputTypes: ['pdf'],
  params: [
    { name: 'angle', type: 'enum', values: ['90', '180', '270'], required: true, description: '旋转角度（度）' },
    { name: 'pageNumbers', type: 'array', items: 'number', required: false, description: '指定旋转的页码（默认所有页）' },
  ],
  performance: 'fast',
  batchable: true,
};

export const PDF_WATERMARK: Capability = {
  name: 'pdf.watermark',
  description: 'Add a text watermark to a PDF',
  inputTypes: ['pdf'],
  outputTypes: ['pdf'],
  params: [
    { name: 'text', type: 'string', required: true, description: '水印文本' },
    { name: 'opacity', type: 'number', min: 0, max: 1, default: 0.3 },
    { name: 'fontSize', type: 'number', default: 48 },
    { name: 'color', type: 'color', default: '#000000' },
  ],
  performance: 'medium',
  batchable: true,
};

export const PDF_OCR: Capability = {
  name: 'pdf.ocr',
  description: 'Extract text from a PDF via OCR',
  inputTypes: ['pdf'],
  outputTypes: ['text'],
  params: [
    { name: 'language', type: 'string', default: 'eng', description: 'OCR 语言代码' },
    { name: 'format', type: 'enum', values: ['text', 'json', 'structured'], default: 'text', description: '输出格式' },
  ],
  performance: 'slow',
  batchable: true,
};

export const PDF_SIGN: Capability = {
  name: 'pdf.sign',
  description: 'Digitally sign a PDF with a certificate',
  inputTypes: ['pdf'],
  outputTypes: ['pdf'],
  params: [
    { name: 'certificate', type: 'file', required: true, description: '签名证书文件' },
    { name: 'password', type: 'string', required: true, description: '证书密码' },
    { name: 'reason', type: 'string', required: false, description: '签名原因' },
  ],
  performance: 'medium',
  batchable: true,
};

// ─── Video ────────────────────────────────────────────────

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

// ─── Asset 通用 ────────────────────────────────────────────

export const ASSET_RENAME: Capability = {
  name: 'asset.rename',
  description: 'Rename asset using a pattern',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  params: [
    {
      name: 'pattern',
      type: 'string',
      required: true,
      description: 'Pattern: {name} {index} {date} {width} {height}',
    },
  ],
  performance: 'fast',
  batchable: true,
};

export const ASSET_ARCHIVE: Capability = {
  name: 'asset.archive',
  description: 'Pack multiple assets into a zip archive',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['data'],
  params: [{ name: 'format', type: 'enum', values: ['zip'], default: 'zip' }],
  performance: 'medium',
  batchable: false,
};

// ─── Developer 工具 ────────────────────────────────────────────

export const DEV_INSPECT_CAPABILITIES: Capability = {
  name: 'developer.inspect.capabilities',
  description: 'List all registered capabilities',
  inputTypes: ['data'],
  outputTypes: ['data'],
  params: [],
  performance: 'fast',
  batchable: false,
};

export const DEV_INSPECT_ASSET: Capability = {
  name: 'developer.inspect.asset',
  description: 'Inspect asset metadata and structure',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['data'],
  params: [
    {
      name: 'verbose',
      type: 'boolean',
      default: false,
      description: 'Include full asset detail (tags, history count, timestamps)',
    },
  ],
  performance: 'fast',
  batchable: true,
};

export const DEV_VALIDATE_WORKFLOW: Capability = {
  name: 'developer.validate.workflow',
  description: 'Validate a workflow without executing it',
  inputTypes: ['data'],
  outputTypes: ['data'],
  params: [],
  performance: 'fast',
  batchable: false,
};

export const DEV_PROFILE: Capability = {
  name: 'developer.profile',
  description: 'Profile capability execution time',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['data'],
  params: [
    {
      name: 'iterations',
      type: 'number',
      default: 1,
      min: 1,
      description: 'Number of profiling iterations per input asset',
    },
  ],
  performance: 'slow',
  batchable: true,
};

/** 所有内置图像能力预设 */
export const IMAGE_CAPABILITIES: Capability[] = [
  IMAGE_RESIZE,
  IMAGE_COMPRESS,
  IMAGE_CONVERT,
  IMAGE_CROP,
  IMAGE_ROTATE,
  IMAGE_FLIP,
  IMAGE_WATERMARK,
  IMAGE_BACKGROUND,
];

/** 所有内置 PDF 能力预设 */
export const PDF_CAPABILITIES: Capability[] = [
  PDF_MERGE,
  PDF_SPLIT,
  PDF_COMPRESS,
  PDF_ROTATE,
  PDF_WATERMARK,
  PDF_OCR,
  PDF_SIGN,
];

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

/** 所有内置 Asset 通用能力预设 */
export const ASSET_CAPABILITIES: Capability[] = [ASSET_RENAME, ASSET_ARCHIVE];

/** 所有内置 Developer 工具能力预设 */
export const DEVELOPER_CAPABILITIES: Capability[] = [
  DEV_INSPECT_CAPABILITIES,
  DEV_INSPECT_ASSET,
  DEV_VALIDATE_WORKFLOW,
  DEV_PROFILE,
];

/** 所有内置能力预设 */
export const BUILTIN_CAPABILITIES: Capability[] = [
  ...IMAGE_CAPABILITIES,
  ...PDF_CAPABILITIES,
  ...VIDEO_CAPABILITIES,
  ...ASSET_CAPABILITIES,
  ...DEVELOPER_CAPABILITIES,
];

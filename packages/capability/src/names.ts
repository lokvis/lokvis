/**
 * 标准能力命名空间与命名约定
 *
 * 命名规则：`<domain>.<action>`，例如 `image.resize`。
 * - domain：能力所属领域，与 AssetType 对齐或为 `asset`/`ai` 等横切领域
 * - action：具体动作，动词或动词短语
 */

export const CAPABILITY_DOMAINS = [
  'asset',
  'image',
  'video',
  'audio',
  'pdf',
  'text',
  'data',
  'ai',
  'developer',
] as const;

export type CapabilityDomain = (typeof CAPABILITY_DOMAINS)[number];

/** 内置能力名常量，避免拼写错误 */
export const CAPABILITY_NAMES = {
  // Asset 通用
  ASSET_IMPORT: 'asset.import',
  ASSET_EXPORT: 'asset.export',
  ASSET_RENAME: 'asset.rename',
  ASSET_ARCHIVE: 'asset.archive',

  // Image
  IMAGE_RESIZE: 'image.resize',
  IMAGE_COMPRESS: 'image.compress',
  IMAGE_CONVERT: 'image.convert',
  IMAGE_CROP: 'image.crop',
  IMAGE_ROTATE: 'image.rotate',
  IMAGE_FLIP: 'image.flip',
  IMAGE_WATERMARK: 'image.watermark',
  IMAGE_BACKGROUND: 'image.background',
  IMAGE_FILTER: 'image.filter',

  // Video
  VIDEO_COMPRESS: 'video.compress',
  VIDEO_TRANSCODE: 'video.transcode',
  VIDEO_TRIM: 'video.trim',
  VIDEO_MERGE: 'video.merge',
  VIDEO_EXTRACT_AUDIO: 'video.extract-audio',
  VIDEO_TO_GIF: 'video.to-gif',
  VIDEO_SCREENSHOT: 'video.screenshot',

  // Audio
  AUDIO_TRIM: 'audio.trim',
  AUDIO_NORMALIZE: 'audio.normalize',
  AUDIO_TRANSCODE: 'audio.transcode',
  AUDIO_MERGE: 'audio.merge',

  // PDF
  PDF_MERGE: 'pdf.merge',
  PDF_SPLIT: 'pdf.split',
  PDF_COMPRESS: 'pdf.compress',
  PDF_ROTATE: 'pdf.rotate',
  PDF_WATERMARK: 'pdf.watermark',
  PDF_OCR: 'pdf.ocr',
  PDF_SIGN: 'pdf.sign',

  // AI
  AI_GENERATE_WORKFLOW: 'ai.generate-workflow',
  AI_OPTIMIZE_WORKFLOW: 'ai.optimize-workflow',
  AI_CAPTION: 'ai.caption',
  AI_OCR: 'ai.ocr',
  AI_BACKGROUND_REMOVE: 'ai.background-remove',
} as const;

export type CapabilityNameKey = keyof typeof CAPABILITY_NAMES;

/** 解析能力名的领域部分 */
export function domainOf(capability: string): string {
  const idx = capability.indexOf('.');
  return idx === -1 ? capability : capability.slice(0, idx);
}

/** 解析能力名的动作部分 */
export function actionOf(capability: string): string {
  const idx = capability.indexOf('.');
  return idx === -1 ? '' : capability.slice(idx + 1);
}

/** 判断两个能力是否属于同一领域 */
export function sameDomain(a: string, b: string): boolean {
  return domainOf(a) === domainOf(b);
}

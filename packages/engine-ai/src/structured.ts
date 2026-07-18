/**
 * @lokvis/engine-ai/structured
 *
 * Blob→结构化信息的 AI 操作子路径(O-16)。
 *
 * 主入口 `@lokvis/engine-ai` 只暴露 Blob↔Blob 纯函数(removeBackground),
 * 遵循 AGENTS.md「Engine 层只暴露 Blob↔Blob」约定。本子路径隔离
 * 返回结构化对象(非 Blob)的 AI 信息提取操作:
 * - ocr(blob):Promise<OcrResult> — 文本识别
 * - caption(blob):Promise<CaptionResult> — 图像描述
 *
 * 与 engine-pdf 的 getPdfInfo(blob):Promise<PdfInfo> 同属「Blob→元数据/信息」
 * 边界张力,通过子路径隔离,使主入口的 Blob↔Blob 纯度更高。
 *
 * Phase 4 实装(transformers.js):trocr(ocr)/ vit-gpt2(caption)。
 */

/** OCR 参数 */
export interface OcrParams {
  language?: string;
  /** 输出格式 */
  format?: 'text' | 'json' | 'structured';
}

/** 字幕生成参数 */
export interface CaptionParams {
  maxTokens?: number;
  language?: string;
}

/** OCR 结果 */
export interface OcrResult {
  text: string;
  blocks?: Array<{ text: string; bbox: [number, number, number, number] }>;
  confidence: number;
}

/** 字幕结果 */
export interface CaptionResult {
  text: string;
  confidence: number;
}

function stubMessage(operation: string): string {
  return `${operation} not implemented in stub (transformers-js). Local AI inference is planned for Phase 4 (transformers.js).`;
}

/**
 * OCR 操作(浏览器 stub)。
 *
 * Phase 4 将用 transformers.js 的 trocr 模型实装本地 OCR。
 */
export async function ocr(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<OcrResult> {
  throw new Error(stubMessage('ocr'));
}

/**
 * 字幕生成操作(浏览器 stub)。
 *
 * Phase 4 将用 transformers.js 的 vit-gpt2 模型实装本地 caption。
 */
export async function caption(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<CaptionResult> {
  throw new Error(stubMessage('caption'));
}

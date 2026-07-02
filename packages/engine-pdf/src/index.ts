/**
 * @lokvis/engine-pdf
 *
 * PDF 引擎适配层。
 *
 * 计划支持的引擎：
 * - pdf-lib：纯 JS PDF 读写（合并、分割、旋转、水印）
 * - pdf.js：PDF 渲染（用于预览与 OCR）
 *
 * 当前状态：MVP 占位实现。
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第六节「Engine Layer」。
 */

import type { AssetType } from '@lokvis/schema';

/** PDF 引擎名 */
export type PdfEngineName = 'pdf-lib' | 'pdfjs';

/** PDF 合并参数 */
export interface PdfMergeParams {
  // 各输入 PDF 按顺序合并
}

/** PDF 分割参数 */
export interface PdfSplitParams {
  /** 每个输出文件包含的页数 */
  pagesPerFile?: number;
  /** 指定页码范围，如 [[1,3],[4,6]] */
  ranges?: Array<[number, number]>;
}

/** PDF 旋转参数 */
export interface PdfRotateParams {
  angle: 90 | 180 | 270;
  /** 指定页码（默认所有页） */
  pageNumbers?: number[];
}

/** PDF 水印参数 */
export interface PdfWatermarkParams {
  text: string;
  opacity?: number;
  fontSize?: number;
  color?: string;
}

/** PDF 压缩参数 */
export interface PdfCompressParams {
  level?: number; // 0-9
}

/** 解码后的 PDF 元数据 */
export interface DecodedPdf {
  pages: number;
  title?: string;
  author?: string;
  creator?: string;
  encrypted: boolean;
}

/** PDF 引擎适配器接口 */
export interface PdfEngineAdapter {
  name: PdfEngineName;
  version: string;
  supportedCapabilities: string[];
  isSupported(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  decode(blob: Blob): Promise<DecodedPdf>;
  merge(blobs: Blob[], params: Record<string, any>): Promise<Blob>;
  split(blob: Blob, params: Record<string, any>): Promise<Blob[]>;
  rotate(blob: Blob, params: Record<string, any>): Promise<Blob>;
  watermark(blob: Blob, params: Record<string, any>): Promise<Blob>;
  compress(blob: Blob, params: Record<string, any>): Promise<Blob>;
}

/** pdf-lib 引擎占位实现 */
export const pdfLibEngine: PdfEngineAdapter = {
  name: 'pdf-lib',
  version: '0.0.0-stub',
  supportedCapabilities: [
    'pdf.merge',
    'pdf.split',
    'pdf.compress',
    'pdf.rotate',
    'pdf.watermark',
  ],
  async isSupported() {
    return true; // 纯 JS，无环境依赖
  },
  async decode() {
    throw new Error('pdfLibEngine.decode not implemented in stub');
  },
  async merge() {
    throw new Error('pdfLibEngine.merge not implemented in stub');
  },
  async split() {
    throw new Error('pdfLibEngine.split not implemented in stub');
  },
  async rotate() {
    throw new Error('pdfLibEngine.rotate not implemented in stub');
  },
  async watermark() {
    throw new Error('pdfLibEngine.watermark not implemented in stub');
  },
  async compress() {
    throw new Error('pdfLibEngine.compress not implemented in stub');
  },
};

/** pdf.js 引擎占位实现（仅渲染，无写入） */
export const pdfjsEngine: PdfEngineAdapter = {
  name: 'pdfjs',
  version: '0.0.0-stub',
  supportedCapabilities: ['pdf.ocr'],
  async isSupported() {
    return typeof Worker !== 'undefined';
  },
  async decode() {
    throw new Error('pdfjsEngine.decode not implemented in stub');
  },
  async merge() {
    throw new Error('pdfjsEngine cannot merge (read-only engine)');
  },
  async split() {
    throw new Error('pdfjsEngine cannot split (read-only engine)');
  },
  async rotate() {
    throw new Error('pdfjsEngine cannot rotate (read-only engine)');
  },
  async watermark() {
    throw new Error('pdfjsEngine cannot watermark (read-only engine)');
  },
  async compress() {
    throw new Error('pdfjsEngine cannot compress (read-only engine)');
  },
};

const engines = new Map<PdfEngineName, PdfEngineAdapter>([
  ['pdf-lib', pdfLibEngine],
  ['pdfjs', pdfjsEngine],
]);

export function registerPdfEngine(engine: PdfEngineAdapter): void {
  engines.set(engine.name, engine);
}

export function getPdfEngine(name?: PdfEngineName): PdfEngineAdapter {
  if (name) {
    const e = engines.get(name);
    if (e) return e;
  }
  return pdfLibEngine;
}

export function listPdfEngines(): PdfEngineAdapter[] {
  return Array.from(engines.values());
}

export async function selectBestPdfEngine(): Promise<PdfEngineAdapter> {
  for (const engine of engines.values()) {
    if (await engine.isSupported()) return engine;
  }
  return pdfLibEngine;
}

export type { AssetType };

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

import { createEngineRegistry } from '@lokvis/engine-core';
import type { AssetType } from '@lokvis/schema';

/** PDF 引擎名 */
export type PdfEngineName = 'pdf-lib' | 'pdfjs';

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

/** PDF OCR 参数 */
export interface PdfOcrParams {
  /** 识别语言（如 'chi_sim'、'eng'） */
  language?: string;
  /** 指定页码（默认所有页） */
  pageNumbers?: number[];
}

/** PDF 数字签名参数 */
export interface PdfSignParams {
  /** 签名证书（PKCS#12 Blob 或路径） */
  certificate: Blob | string;
  /** 证书密码 */
  password: string;
  /** 签名原因（写入 Signature 词典） */
  reason?: string;
  /** 签名位置 [x, y, width, height]（PDF 坐标系，单位 pt） */
  rect?: [number, number, number, number];
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
  /** OCR 识别（pdf.js 引擎承载，输出 text/plain Blob） */
  ocr(blob: Blob, params: Record<string, any>): Promise<Blob>;
  /** 数字签名（pdf-lib 引擎承载） */
  sign(blob: Blob, params: Record<string, any>): Promise<Blob>;
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
    'pdf.sign',
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
  async ocr() {
    throw new Error('pdfLibEngine.ocr not implemented in stub');
  },
  async sign() {
    throw new Error('pdfLibEngine.sign not implemented in stub');
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
    throw new Error('pdfjsEngine.merge not implemented in stub');
  },
  async split() {
    throw new Error('pdfjsEngine.split not implemented in stub');
  },
  async rotate() {
    throw new Error('pdfjsEngine.rotate not implemented in stub');
  },
  async watermark() {
    throw new Error('pdfjsEngine.watermark not implemented in stub');
  },
  async compress() {
    throw new Error('pdfjsEngine.compress not implemented in stub');
  },
  async ocr() {
    throw new Error('pdfjsEngine.ocr not implemented in stub');
  },
  async sign() {
    throw new Error('pdfjsEngine.sign not implemented in stub');
  },
};

// ─── 引擎注册表(委托 @lokvis/engine-core 工厂) ───────────
// 旧版手写 Map + register/get/list/selectBest 四个函数,与 engine-audio /
// engine-video / engine-ai 完全相同。改为 createEngineRegistry 一次构造,
// 消除四份重复样板。get(name?) 未命中时 fallback 到 pdfLibEngine。
const registry = createEngineRegistry<PdfEngineAdapter>(
  [pdfLibEngine, pdfjsEngine],
  pdfLibEngine
);

export function registerPdfEngine(engine: PdfEngineAdapter): void {
  registry.register(engine);
}

export function getPdfEngine(name?: PdfEngineName): PdfEngineAdapter {
  return registry.get(name);
}

export function listPdfEngines(): PdfEngineAdapter[] {
  return registry.list();
}

export async function selectBestPdfEngine(): Promise<PdfEngineAdapter> {
  return registry.selectBest();
}

// ─── 独立 Blob↔Blob 操作(供不经能力系统的 Node 消费方直接调用) ───
// PdfEngineAdapter 仍为 stub(能力系统绑定);本模块为已实装操作,
// 未来 plugin-pdf/node 实装时 adapter 方法会委托到此(见 TD-1.4)。
// PdfMergeParams / PdfCompressParams / PdfInfo 定义在 operations.ts,
// 此处统一 re-export,消除 index.ts 与 operations.ts 的重复定义。
export {
  mergePdfs,
  compressPdf,
  getPdfInfo,
  type PdfMergeParams,
  type PdfCompressParams,
  type PdfInfo,
} from './operations.js';

export type { AssetType };

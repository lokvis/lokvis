/**
 * PDF Blob↔Blob 操作(基于 pdf-lib)
 *
 * 与 engine-image/node 的 operations/ 模式对齐:暴露独立操作的纯函数,
 * 供消费方(如 mcp-server tool handler)直接调用。pdf-lib 经动态 import
 * 加载,浏览器侧 plugin-pdf 只导入 PdfEngineAdapter(stub),不会拉入 pdf-lib。
 *
 * 与 PdfEngineAdapter 的关系:
 * - PdfEngineAdapter(下方 pdfLibEngine/pdfjsEngine)是 **能力系统绑定**,
 *   当前为 stub(version 含 'stub'),plugin-pdf 据此标记 capability 为 stub
 * - 本文件的独立操作是 **Engine 层 Blob↔Blob 实现**,供不经能力系统的
 *   Node 消费方(mcp-server)直接使用
 * - 未来 plugin-pdf/node 实装时,adapter 方法会委托到本文件操作,
 *   version 升为非-stub(见 TD-1.4 长期方案)
 *
 * AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow。
 * 不使用 Node 专属类型(Buffer),仅用标准 Blob/ArrayBuffer/Uint8Array,
 * 使本模块在浏览器与 Node 均可类型检查(与 engine-pdf 包的跨端定位一致)。
 */

/** PDF 合并参数(各输入 PDF 按顺序合并,无额外选项) */
export interface PdfMergeParams {
  // 各输入 PDF 按顺序合并
}

/** PDF 压缩参数 */
export interface PdfCompressParams {
  /** 压缩级别 0-9(>=4 启用对象流压缩,默认 6) */
  level?: number;
}

/** PDF 拆分参数(二选一:pagesPerFile 或 ranges,二者均缺省时按 1 页/文件拆分) */
export interface PdfSplitParams {
  /** 每个输出文件包含的页数(默认 1,即每页一个文件) */
  pagesPerFile?: number;
  /** 显式页码范围(从 1 开始,如 [[1,3],[4,6]] 表示第 1-3 页一个文件、4-6 页一个文件) */
  ranges?: Array<[number, number]>;
}

/** PDF 旋转参数 */
export interface PdfRotateParams {
  /** 旋转角度(只接受 90 / 180 / 270) */
  angle: 90 | 180 | 270;
  /** 指定旋转的页码(从 1 开始,默认所有页) */
  pageNumbers?: number[];
}

/** PDF 水印参数 */
export interface PdfWatermarkParams {
  /** 水印文本(必填) */
  text: string;
  /** 不透明度 0-1(默认 0.3) */
  opacity?: number;
  /** 字号(默认 48) */
  fontSize?: number;
  /** 颜色,十六进制(默认 "#000000") */
  color?: string;
}

/** PDF OCR 参数(本阶段不实装,留作 stub 接口) */
export interface PdfOcrParams {
  /** OCR 语言代码(默认 "eng") */
  language?: string;
  /** 输出格式(默认 "text") */
  format?: 'text' | 'json' | 'structured';
}

/** PDF 基本信息(供消费方报告页数等元数据,类型由 @lokvis/schema 共享) */
import type { PdfInfo } from '@lokvis/schema';
export type { PdfInfo };

/** 把 Blob 转为 ArrayBuffer(pdf-lib 的 load 接受 ArrayBuffer) */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

/** 把 Uint8Array(pdf-lib save 返回)转为 Blob 兼容的 ArrayBuffer */
function uint8ToBlobPart(bytes: Uint8Array): ArrayBuffer {
  // bytes.buffer 为 ArrayBufferLike(TS 5.7+ 保守类型),slice 出独立 ArrayBuffer
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

/**
 * 合并多个 PDF(Blob[] → Blob)。
 *
 * @param blobs 输入 PDF Blob 数组(至少 2 个)
 * @param _params 合并参数(当前无选项,保留以与 adapter 签名对齐)
 */
export async function mergePdfs(
  blobs: Blob[],
  _params: Record<string, any> = {}
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const mergedPdf = await PDFDocument.create();

  for (const blob of blobs) {
    const bytes = await blobToArrayBuffer(blob);
    const srcPdf = await PDFDocument.load(bytes);
    const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
    for (const page of pages) {
      mergedPdf.addPage(page);
    }
  }

  const outputBytes = await mergedPdf.save();
  return new Blob([uint8ToBlobPart(outputBytes)], { type: 'application/pdf' });
}

/**
 * 压缩 PDF(Blob → Blob)。
 *
 * pdf-lib 的压缩能力有限(对象流压缩 + 移除冗余)。深度压缩(图片降采样)
 * 需 ghostscript 等外部工具,留待后续。
 *
 * @param blob 输入 PDF Blob
 * @param params 压缩参数(level: 0-9,>=4 启用对象流,默认 6)
 */
export async function compressPdf(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const level = (params as PdfCompressParams).level ?? 6;
  if (level < 0 || level > 9) {
    throw new Error(`compressPdf: level must be between 0 and 9, got ${level}`);
  }
  const bytes = await blobToArrayBuffer(blob);
  const pdfDoc = await PDFDocument.load(bytes);

  // level 0-3: 不启用对象流(快速保存);level 4-9: 启用对象流(压缩率更高)
  const outputBytes = await pdfDoc.save({
    useObjectStreams: level >= 4,
  });

  return new Blob([uint8ToBlobPart(outputBytes)], { type: 'application/pdf' });
}

/**
 * 读取 PDF 基本信息(页数),不修改输入。
 *
 * @param blob 输入 PDF Blob
 */
export async function getPdfInfo(blob: Blob): Promise<PdfInfo> {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await blobToArrayBuffer(blob);
  const pdfDoc = await PDFDocument.load(bytes);
  return { pages: pdfDoc.getPageCount() };
}

/**
 * 拆分 PDF(Blob → Blob[])。
 *
 * 支持两种模式:
 * - `ranges`:显式指定页码范围(从 1 开始),如 `[[1,3],[4,6]]` 输出 2 个文件
 * - `pagesPerFile`:每 N 页一个文件(默认 1,即每页一个文件)
 *
 * 二者均缺省时按每页一个文件拆分。`ranges` 优先于 `pagesPerFile`。
 *
 * @param blob 输入 PDF Blob
 * @param params 拆分参数
 */
export async function splitPdf(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob[]> {
  const { PDFDocument } = await import('pdf-lib');
  const bytes = await blobToArrayBuffer(blob);
  const srcPdf = await PDFDocument.load(bytes);
  const totalPages = srcPdf.getPageCount();

  // 解析 ranges(优先)或 pagesPerFile
  const ranges = parseSplitRanges(params, totalPages);
  if (ranges.length === 0) {
    return [];
  }

  const outputs: Blob[] = [];
  for (const [start, end] of ranges) {
    const outPdf = await PDFDocument.create();
    // copyPages 接受 0-based 索引数组
    const pageIndices: number[] = [];
    for (let p = start; p <= end; p++) {
      pageIndices.push(p - 1); // 1-based → 0-based
    }
    const copied = await outPdf.copyPages(srcPdf, pageIndices);
    for (const page of copied) {
      outPdf.addPage(page);
    }
    const outBytes = await outPdf.save();
    outputs.push(
      new Blob([uint8ToBlobPart(outBytes)], { type: 'application/pdf' })
    );
  }
  return outputs;
}

/**
 * 解析拆分范围(1-based 闭区间)。
 *
 * 优先级:`params.ranges` > `params.pagesPerFile` > 默认(每页一个文件)。
 * 校验越界/无效范围,抛错给出明确提示。
 */
function parseSplitRanges(
  params: Record<string, any>,
  totalPages: number
): Array<[number, number]> {
  const rangesParam = (params as PdfSplitParams).ranges;
  if (Array.isArray(rangesParam) && rangesParam.length > 0) {
    const result: Array<[number, number]> = [];
    for (const r of rangesParam) {
      if (
        !Array.isArray(r) ||
        r.length !== 2 ||
        typeof r[0] !== 'number' ||
        typeof r[1] !== 'number'
      ) {
        throw new Error(
          `splitPdf: each range must be [number, number], got ${JSON.stringify(r)}`
        );
      }
      const [s, e] = r as [number, number];
      if (s < 1 || e > totalPages || s > e) {
        throw new Error(
          `splitPdf: range [${s},${e}] out of bounds (total pages: ${totalPages})`
        );
      }
      result.push([s, e]);
    }
    return result;
  }

  const pagesPerFile = (params as PdfSplitParams).pagesPerFile ?? 1;
  if (!Number.isInteger(pagesPerFile) || pagesPerFile < 1) {
    throw new Error(
      `splitPdf: pagesPerFile must be a positive integer, got ${pagesPerFile}`
    );
  }

  const result: Array<[number, number]> = [];
  for (let start = 1; start <= totalPages; start += pagesPerFile) {
    const end = Math.min(start + pagesPerFile - 1, totalPages);
    result.push([start, end]);
  }
  return result;
}

/**
 * 旋转 PDF 页面(Blob → Blob)。
 *
 * @param blob 输入 PDF Blob
 * @param params 旋转参数(angle: 90/180/270,pageNumbers?: 默认所有页)
 */
export async function rotatePdf(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const angle = (params as PdfRotateParams).angle;
  if (angle !== 90 && angle !== 180 && angle !== 270) {
    throw new Error(
      `rotatePdf: angle must be 90 / 180 / 270, got ${angle}`
    );
  }

  const bytes = await blobToArrayBuffer(blob);
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();

  // 解析目标页码集合(1-based → 0-based);缺省时为所有页
  const pageNumbersParam = (params as PdfRotateParams).pageNumbers;
  let targetIndices: Set<number>;
  if (Array.isArray(pageNumbersParam) && pageNumbersParam.length > 0) {
    targetIndices = new Set(
      pageNumbersParam.map((p) => {
        if (!Number.isInteger(p) || p < 1 || p > pages.length) {
          throw new Error(
            `rotatePdf: page number ${p} out of bounds (total pages: ${pages.length})`
          );
        }
        return p - 1; // 1-based → 0-based
      })
    );
  } else {
    targetIndices = new Set(pages.map((_, i) => i));
  }

  // pdf-lib 的 setRotation 接受 degrees() 包装的角度(绝对值,非增量)
  // 累加到现有 rotation 上以支持多次旋转(参考 pdf-lib README)
  for (let i = 0; i < pages.length; i++) {
    if (targetIndices.has(i)) {
      // 索引已在 length 内,断言非空(noUncheckedIndexedAccess)
      const page = pages[i]!;
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    }
  }

  const outBytes = await pdfDoc.save();
  return new Blob([uint8ToBlobPart(outBytes)], { type: 'application/pdf' });
}

/**
 * 解析十六进制颜色(#RRGGBB 或 #RGB)为 pdf-lib rgb() 所需的 0-1 分量。
 *
 * @param hex 形如 "#000000" / "#fff" / "000000"
 * @returns [r, g, b],每个分量 0-1
 */
function parseHexColor(hex: string): [number, number, number] {
  let h = hex.trim();
  if (h.startsWith('#')) {
    h = h.slice(1);
  }
  if (h.length === 3) {
    // 短格式 #RGB → #RRGGBB
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`addWatermark: invalid color "${hex}", expected #RRGGBB or #RGB`);
  }
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * 给 PDF 添加文本水印(Blob → Blob)。
 *
 * 水印以对角线方式绘制到每一页(45 度倾斜、居中、半透明)。
 *
 * @param blob 输入 PDF Blob
 * @param params 水印参数(text 必填,opacity/fontSize/color 可选)
 */
export async function addWatermark(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const wp = params as PdfWatermarkParams;
  if (typeof wp.text !== 'string' || wp.text.length === 0) {
    throw new Error('addWatermark: text is required and must be non-empty');
  }

  const opacity = wp.opacity ?? 0.3;
  if (opacity < 0 || opacity > 1) {
    throw new Error(`addWatermark: opacity must be 0-1, got ${opacity}`);
  }
  const fontSize = wp.fontSize ?? 48;
  if (fontSize <= 0) {
    throw new Error(`addWatermark: fontSize must be > 0, got ${fontSize}`);
  }
  const [r, g, b] = parseHexColor(wp.color ?? '#000000');

  const bytes = await blobToArrayBuffer(blob);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(wp.text, fontSize);
    // 居中并 45 度倾斜
    const x = (width - textWidth) / 2;
    const y = height / 2;
    page.drawText(wp.text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(r, g, b),
      opacity,
      rotate: degrees(45),
    });
  }

  const outBytes = await pdfDoc.save();
  return new Blob([uint8ToBlobPart(outBytes)], { type: 'application/pdf' });
}

/**
 * OCR PDF(Blob → text Blob)— 当前为 stub。
 *
 * OCR 实装依赖 tesseract.js(体积大,~2MB),按 B1 计划留 Phase 3。
 * 本函数抛错,plugin-pdf 据此标记 capability 为 stub,
 * CapabilityRegistry.resolve() 自动跳过。
 *
 * @param _blob 输入 PDF Blob
 * @param _params OCR 参数
 */
export async function ocrPdf(
  _blob: Blob,
  _params: Record<string, any> = {}
): Promise<Blob> {
  throw new Error(
    'ocrPdf not implemented in stub (requires tesseract.js, planned for Phase 3)'
  );
}

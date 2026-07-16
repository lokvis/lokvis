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

/** PDF 基本信息(供消费方报告页数等元数据) */
export interface PdfInfo {
  pages: number;
}

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

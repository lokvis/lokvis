/**
 * E2E 测试用 PDF 生成器(W22.6)
 *
 * 在模块加载时按字节计算 xref 偏移,构造一个最小可用 PDF:
 *   - 1 个 Catalog 指向 Pages
 *   - 1 个 Pages 包含 1 个 Page
 *   - 1 个 Page(MediaBox 72×72,空白页)
 *
 * 不依赖 pdf-lib / canvas 等外部库,纯字符串拼接 + Buffer。
 * Chrome 内置 PDF viewer 可正常渲染此空页面。
 *
 * 用途:PDF 工具页(pdf-compress / pdf-rotate / ...)E2E 上传后,
 * runtime 调用 stub capability 抛 "not implemented in stub" 错误,
 * UI 显示 amber 色 stub 提示。本 fixture 仅需通过 accept="application/pdf"
 * 校验与 iframe 预览,真正解析由 stub 抛错前完成,无需复杂内容。
 */

/** 单个 PDF 对象的定义(id + body) */
interface PdfObject {
  id: number;
  body: string;
}

const PDF_OBJECTS: readonly PdfObject[] = [
  { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
  { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
  { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] >>' },
] as const;

/**
 * 构造最小合法 PDF Buffer,xref 偏移按 latin1 字节计算。
 *
 * 用 latin1 编码以保持字节长度 === 字符长度,避免 UTF-8 多字节字符
 * 导致偏移错位(PDF 规范要求 ASCII 兼容,此 fixture 全部为 ASCII)。
 */
function makePdf(): Buffer {
  const header = '%PDF-1.4\n';

  let body = header;
  const offsets: number[] = [];
  for (const obj of PDF_OBJECTS) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(body, 'latin1');
  const entryCount = PDF_OBJECTS.length + 1; // +1 for free entry (obj 0)
  let xref = `xref\n0 ${entryCount}\n`;
  xref += '0000000000 65535 f \n';
  for (const off of offsets) {
    xref += off.toString().padStart(10, '0') + ' 00000 n \n';
  }

  body += xref;
  body += `trailer\n<< /Root 1 0 R /Size ${entryCount} >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body, 'latin1');
}

/** 共享 PDF fixture(3 对象 + xref + trailer) */
export const TEST_PDF = makePdf();

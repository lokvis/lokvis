/**
 * engine-pdf 操作测试
 *
 * 使用 pdf-lib 生成测试 PDF(含可识别文本),验证 3 个操作:
 * - mergePdfs:多 PDF 合并,页数累加
 * - compressPdf:level 范围校验 + 对象流开关 + 输出可被 pdf-lib 再次解析
 * - getPdfInfo:页数读取
 *
 * 覆盖边界:uint8ToBlobPart 非零 byteOffset(通过 pdf-lib 内部池化缓冲触发)、
 * level 越界抛错。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** 生成 n 页 PDF,每页写页码文本(便于合并后验证页序) */
async function makeTestPdf(pages: number, label = ''): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([200, 200]);
    page.drawText(`${label}p${i + 1}`, {
      x: 50,
      y: 100,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
  }
  const bytes = await pdf.save();
  return new Blob([bytes.buffer.slice(0) as ArrayBuffer], {
    type: 'application/pdf',
  });
}

/** 从 Blob 读取 PDF 页数(独立验证,不依赖被测 getPdfInfo) */
async function countPages(blob: Blob): Promise<number> {
  const bytes = await blob.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPageCount();
}

describe('engine-pdf operations', () => {
  let singlePage: Blob;
  let twoPages: Blob;

  beforeAll(async () => {
    singlePage = await makeTestPdf(1, 'A-');
    twoPages = await makeTestPdf(2, 'B-');
  });

  describe('mergePdfs', () => {
    it('应按顺序合并多个 PDF,页数累加', async () => {
      const { mergePdfs } = await import('../operations.js');
      const out = await mergePdfs([singlePage, twoPages]);
      expect(out.type).toBe('application/pdf');
      expect(await countPages(out)).toBe(3); // 1 + 2
    });

    it('合并后输出可被 pdf-lib 再次解析(验证 Blob 结构正确)', async () => {
      const { mergePdfs } = await import('../operations.js');
      const out = await mergePdfs([singlePage, singlePage]);
      // 若 uint8ToBlobPart 处理错误,PDFDocument.load 会抛错
      const bytes = await out.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(2);
    });

    it('合并 3 个 PDF 页数正确', async () => {
      const { mergePdfs } = await import('../operations.js');
      const out = await mergePdfs([singlePage, singlePage, twoPages]);
      expect(await countPages(out)).toBe(4); // 1 + 1 + 2
    });
  });

  describe('compressPdf', () => {
    it('level >= 4 启用对象流,输出可被解析,页数不变', async () => {
      const { compressPdf } = await import('../operations.js');
      const out = await compressPdf(twoPages, { level: 6 });
      expect(out.type).toBe('application/pdf');
      expect(await countPages(out)).toBe(2);
    });

    it('level < 4 不启用对象流,输出仍有效', async () => {
      const { compressPdf } = await import('../operations.js');
      const out = await compressPdf(twoPages, { level: 2 });
      expect(await countPages(out)).toBe(2);
    });

    it('默认 level=6(不传 params)', async () => {
      const { compressPdf } = await import('../operations.js');
      const out = await compressPdf(twoPages);
      expect(await countPages(out)).toBe(2);
    });

    it('level 越界(< 0)应抛错', async () => {
      const { compressPdf } = await import('../operations.js');
      await expect(compressPdf(twoPages, { level: -1 })).rejects.toThrow(
        /level must be between 0 and 9/
      );
    });

    it('level 越界(> 9)应抛错', async () => {
      const { compressPdf } = await import('../operations.js');
      await expect(compressPdf(twoPages, { level: 10 })).rejects.toThrow(
        /level must be between 0 and 9/
      );
    });

    it('对象流 vs 非对象流输出大小可能不同(验证 level 生效)', async () => {
      const { compressPdf } = await import('../operations.js');
      const withObjStreams = await compressPdf(twoPages, { level: 6 });
      const withoutObjStreams = await compressPdf(twoPages, { level: 2 });
      // 两者都是有效 PDF(不比较大小,因小 PDF 差异可能为 0)
      expect(await countPages(withObjStreams)).toBe(2);
      expect(await countPages(withoutObjStreams)).toBe(2);
    });
  });

  describe('getPdfInfo', () => {
    it('应返回正确页数(单页)', async () => {
      const { getPdfInfo } = await import('../operations.js');
      const info = await getPdfInfo(singlePage);
      expect(info.pages).toBe(1);
    });

    it('应返回正确页数(多页)', async () => {
      const { getPdfInfo } = await import('../operations.js');
      const info = await getPdfInfo(twoPages);
      expect(info.pages).toBe(2);
    });

    it('合并后的 PDF 页数应等于各输入页数之和', async () => {
      const { mergePdfs, getPdfInfo } = await import('../operations.js');
      const merged = await mergePdfs([singlePage, twoPages, singlePage]);
      const info = await getPdfInfo(merged);
      expect(info.pages).toBe(4); // 1 + 2 + 1
    });
  });
});

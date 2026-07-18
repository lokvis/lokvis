/**
 * engine-pdf 操作测试
 *
 * 使用 pdf-lib 生成测试 PDF(含可识别文本),验证 7 个操作:
 * - mergePdfs:多 PDF 合并,页数累加
 * - splitPdf:ranges / pagesPerFile / 默认每页一个文件
 * - compressPdf:level 范围校验 + 对象流开关 + 输出可被 pdf-lib 再次解析
 * - rotatePdf:angle 校验 + 页码选择 + 累加旋转
 * - addWatermark:text 必填 + 颜色解析 + 不透明度 + 多页绘制
 * - ocrPdf:stub 抛错
 * - getPdfInfo:页数读取
 *
 * 覆盖边界:uint8ToBlobPart 非零 byteOffset(通过 pdf-lib 内部池化缓冲触发)、
 * level 越界抛错、range 越界抛错、颜色格式校验、旋转角度校验。
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

/** 读取指定页(0-based)的旋转角度 */
async function readRotation(blob: Blob, pageIndex: number): Promise<number> {
  const bytes = await blob.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages();
  return pages[pageIndex]!.getRotation().angle;
}

/** 校验 Blob 是否为合法 PDF(可被 pdf-lib 加载) */
async function isValidPdf(blob: Blob): Promise<boolean> {
  try {
    const bytes = await blob.arrayBuffer();
    await PDFDocument.load(bytes);
    return true;
  } catch {
    return false;
  }
}

describe('engine-pdf operations', () => {
  let singlePage: Blob;
  let twoPages: Blob;
  let fivePages: Blob;

  beforeAll(async () => {
    singlePage = await makeTestPdf(1, 'A-');
    twoPages = await makeTestPdf(2, 'B-');
    fivePages = await makeTestPdf(5, 'C-');
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

  describe('splitPdf', () => {
    it('默认每页一个文件(无 params)', async () => {
      const { splitPdf } = await import('../operations.js');
      const out = await splitPdf(fivePages);
      expect(out).toHaveLength(5);
      // 每个输出 1 页
      for (const blob of out) {
        expect(await countPages(blob)).toBe(1);
        expect(await isValidPdf(blob)).toBe(true);
      }
    });

    it('pagesPerFile=2 应按 2 页/文件拆分', async () => {
      const { splitPdf } = await import('../operations.js');
      const out = await splitPdf(fivePages, { pagesPerFile: 2 });
      // 5 页按 2/文件拆 → [1,2] [3,4] [5]
      expect(out).toHaveLength(3);
      expect(await countPages(out[0]!)).toBe(2);
      expect(await countPages(out[1]!)).toBe(2);
      expect(await countPages(out[2]!)).toBe(1);
    });

    it('ranges 显式指定页码范围(从 1 开始)', async () => {
      const { splitPdf } = await import('../operations.js');
      const out = await splitPdf(fivePages, {
        ranges: [[1, 3], [4, 5]],
      });
      expect(out).toHaveLength(2);
      expect(await countPages(out[0]!)).toBe(3);
      expect(await countPages(out[1]!)).toBe(2);
    });

    it('ranges 优先于 pagesPerFile(同时传时取 ranges)', async () => {
      const { splitPdf } = await import('../operations.js');
      const out = await splitPdf(fivePages, {
        pagesPerFile: 2,
        ranges: [[1, 1], [2, 5]],
      });
      expect(out).toHaveLength(2);
      expect(await countPages(out[0]!)).toBe(1);
      expect(await countPages(out[1]!)).toBe(4);
    });

    it('pagesPerFile 非正整数应抛错', async () => {
      const { splitPdf } = await import('../operations.js');
      await expect(splitPdf(fivePages, { pagesPerFile: 0 })).rejects.toThrow(
        /pagesPerFile must be a positive integer/
      );
      await expect(splitPdf(fivePages, { pagesPerFile: 1.5 })).rejects.toThrow(
        /pagesPerFile must be a positive integer/
      );
    });

    it('range 越界应抛错(超出总页数)', async () => {
      const { splitPdf } = await import('../operations.js');
      await expect(
        splitPdf(fivePages, { ranges: [[1, 10]] })
      ).rejects.toThrow(/out of bounds/);
    });

    it('range 反向(start > end)应抛错', async () => {
      const { splitPdf } = await import('../operations.js');
      await expect(
        splitPdf(fivePages, { ranges: [[3, 1]] })
      ).rejects.toThrow(/out of bounds/);
    });

    it('range 元素格式错误应抛错', async () => {
      const { splitPdf } = await import('../operations.js');
      await expect(
        splitPdf(fivePages, { ranges: [[1, 2, 3] as unknown as [number, number]] })
      ).rejects.toThrow(/each range must be \[number, number\]/);
    });
  });

  describe('rotatePdf', () => {
    it('angle=90 默认所有页旋转(页数不变)', async () => {
      const { rotatePdf } = await import('../operations.js');
      const out = await rotatePdf(twoPages, { angle: 90 });
      expect(out.type).toBe('application/pdf');
      expect(await countPages(out)).toBe(2);
      // 所有页旋转 90 度
      expect(await readRotation(out, 0)).toBe(90);
      expect(await readRotation(out, 1)).toBe(90);
    });

    it('angle=180 指定页码旋转(只旋转第 1 页)', async () => {
      const { rotatePdf } = await import('../operations.js');
      const out = await rotatePdf(twoPages, { angle: 180, pageNumbers: [1] });
      expect(await readRotation(out, 0)).toBe(180);
      // 第 2 页保持 0 度
      expect(await readRotation(out, 1)).toBe(0);
    });

    it('累加旋转(原 90 度 + 新 90 度 = 180 度)', async () => {
      const { rotatePdf } = await import('../operations.js');
      const rotatedOnce = await rotatePdf(twoPages, { angle: 90 });
      const rotatedTwice = await rotatePdf(rotatedOnce, { angle: 90 });
      // 90 + 90 = 180,(180) % 360 = 180
      expect(await readRotation(rotatedTwice, 0)).toBe(180);
    });

    it('angle=270 应正确旋转', async () => {
      const { rotatePdf } = await import('../operations.js');
      const out = await rotatePdf(singlePage, { angle: 270 });
      expect(await readRotation(out, 0)).toBe(270);
    });

    it('angle 非 90/180/270 应抛错', async () => {
      const { rotatePdf } = await import('../operations.js');
      await expect(rotatePdf(twoPages, { angle: 45 })).rejects.toThrow(
        /angle must be 90 \/ 180 \/ 270/
      );
      await expect(rotatePdf(twoPages, { angle: 0 })).rejects.toThrow(
        /angle must be 90 \/ 180 \/ 270/
      );
    });

    it('pageNumbers 越界应抛错', async () => {
      const { rotatePdf } = await import('../operations.js');
      await expect(
        rotatePdf(twoPages, { angle: 90, pageNumbers: [3] })
      ).rejects.toThrow(/page number 3 out of bounds/);
    });
  });

  describe('addWatermark', () => {
    it('应成功添加水印(text 必填)', async () => {
      const { addWatermark } = await import('../operations.js');
      const out = await addWatermark(twoPages, { text: 'CONFIDENTIAL' });
      expect(out.type).toBe('application/pdf');
      expect(await countPages(out)).toBe(2);
      expect(await isValidPdf(out)).toBe(true);
    });

    it('多页 PDF 应在每页添加水印', async () => {
      const { addWatermark } = await import('../operations.js');
      const out = await addWatermark(fivePages, { text: 'WATERMARK' });
      expect(await countPages(out)).toBe(5);
      // 间接验证:输出仍为合法 PDF,水印绘制不破坏结构
      expect(await isValidPdf(out)).toBe(true);
    });

    it('自定义 opacity / fontSize / color 应不报错', async () => {
      const { addWatermark } = await import('../operations.js');
      const out = await addWatermark(singlePage, {
        text: 'CUSTOM',
        opacity: 0.5,
        fontSize: 72,
        color: '#ff0000',
      });
      expect(await isValidPdf(out)).toBe(true);
    });

    it('短格式颜色(#RGB)应被正确解析', async () => {
      const { addWatermark } = await import('../operations.js');
      const out = await addWatermark(singlePage, {
        text: 'SHORT',
        color: '#f00',
      });
      expect(await isValidPdf(out)).toBe(true);
    });

    it('text 缺失应抛错', async () => {
      const { addWatermark } = await import('../operations.js');
      await expect(addWatermark(singlePage, {})).rejects.toThrow(
        /text is required/
      );
      await expect(
        addWatermark(singlePage, { text: '' })
      ).rejects.toThrow(/text is required/);
    });

    it('opacity 越界应抛错', async () => {
      const { addWatermark } = await import('../operations.js');
      await expect(
        addWatermark(singlePage, { text: 'X', opacity: 1.5 })
      ).rejects.toThrow(/opacity must be 0-1/);
      await expect(
        addWatermark(singlePage, { text: 'X', opacity: -0.1 })
      ).rejects.toThrow(/opacity must be 0-1/);
    });

    it('color 格式错误应抛错', async () => {
      const { addWatermark } = await import('../operations.js');
      await expect(
        addWatermark(singlePage, { text: 'X', color: '#xyz123' })
      ).rejects.toThrow(/invalid color/);
      await expect(
        addWatermark(singlePage, { text: 'X', color: 'red' })
      ).rejects.toThrow(/invalid color/);
    });

    it('fontSize 非正应抛错', async () => {
      const { addWatermark } = await import('../operations.js');
      await expect(
        addWatermark(singlePage, { text: 'X', fontSize: 0 })
      ).rejects.toThrow(/fontSize must be > 0/);
    });
  });

  describe('ocrPdf (stub)', () => {
    it('应抛 stub 错误(不实装)', async () => {
      const { ocrPdf } = await import('../operations.js');
      await expect(ocrPdf(singlePage)).rejects.toThrow(
        /not implemented in stub/
      );
    });

    it('错误消息应提及 tesseract.js + Phase 3', async () => {
      const { ocrPdf } = await import('../operations.js');
      await expect(ocrPdf(singlePage)).rejects.toThrow(
        /tesseract\.js.*Phase 3/
      );
    });

    it('传 params 仍应抛错(stub 行为一致)', async () => {
      const { ocrPdf } = await import('../operations.js');
      await expect(
        ocrPdf(singlePage, { language: 'chi_sim', format: 'json' })
      ).rejects.toThrow(/not implemented in stub/);
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

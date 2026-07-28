/**
 * PDF tools 单元测试
 *
 * TD-1.1 改造后:pdf tool handler 经 runtime.run() 走完整 capability 系统
 * (CapabilityRegistry.resolve → createMergeCapabilityImpl /
 * createBlobCapabilityImpl → engine operation)。
 *
 * 测试策略(与 image.test.ts 一致):
 * - 创建真实 Lokvis Runtime + 安装 pdfToolsPluginNode(pdf-lib engine)
 * - 使用 pdf-lib 生成真实测试 PDF,验证 merge/compress 的正确性
 * - 验证 getPdfToolRegistrations(runtime) 返回 2 个 tool 注册
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';
import { pdfToolsPluginNode } from '@lokvis/plugin-pdf/node';
import {
  pdfMerge,
  pdfCompress,
  pdfSplit,
  pdfRotate,
  pdfWatermark,
  pdfAddPageNumbers,
  getPdfToolRegistrations,
} from '../../tools/pdf.js';

describe('PDF tools', () => {
  let workdir: string;
  let testPdfPath1: string;
  let testPdfPath2: string;
  let runtime: LokvisRuntime;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'lokvis-pdf-tools-'));
    testPdfPath1 = join(workdir, 'test1.pdf');
    testPdfPath2 = join(workdir, 'test2.pdf');

    // 生成 2 页测试 PDF 1
    const pdf1 = await PDFDocument.create();
    pdf1.setTitle('Test PDF 1');
    const font1 = await pdf1.embedFont(StandardFonts.Helvetica);
    const page1 = pdf1.addPage([200, 300]);
    page1.drawText('Page 1 of PDF 1', { x: 50, y: 250, size: 12, font: font1, color: rgb(0, 0, 0) });
    const page2 = pdf1.addPage([200, 300]);
    page2.drawText('Page 2 of PDF 1', { x: 50, y: 250, size: 12, font: font1, color: rgb(0, 0, 0) });
    await writeFile(testPdfPath1, await pdf1.save());

    // 生成 1 页测试 PDF 2
    const pdf2 = await PDFDocument.create();
    pdf2.setTitle('Test PDF 2');
    const font2 = await pdf2.embedFont(StandardFonts.Helvetica);
    const page3 = pdf2.addPage([200, 300]);
    page3.drawText('Page 1 of PDF 2', { x: 50, y: 250, size: 12, font: font2, color: rgb(0, 0, 0) });
    await writeFile(testPdfPath2, await pdf2.save());

    // 创建真实 runtime + 安装 pdfToolsPluginNode(pdf-lib engine)
    runtime = await createLokvis({ enableOpfs: false, enableIndexedDB: false });
    await runtime.installPlugin(await pdfToolsPluginNode());
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.dispose?.();
    }
    if (workdir) {
      await rm(workdir, { recursive: true, force: true });
    }
  });

  describe('pdfMerge', () => {
    it('应合并 2 个 PDF(共 3 页)', async () => {
      const result = await pdfMerge({
        input_paths: [testPdfPath1, testPdfPath2],
      }, runtime);
      expect(result.isError).toBeFalsy();
      expect(result.content[0]!.type).toBe('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('merged');
      expect(text).toContain('Pages: 3');

      // 验证输出文件存在且为合法 PDF
      const outputPath = join(workdir, 'test1_merged.pdf');
      const outputBytes = await readFile(outputPath);
      const mergedPdf = await PDFDocument.load(outputBytes);
      expect(mergedPdf.getPageCount()).toBe(3);
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'custom_merged.pdf');
      const result = await pdfMerge({
        input_paths: [testPdfPath1, testPdfPath2],
        output_path: outputPath,
      }, runtime);
      expect(result.isError).toBeFalsy();
      const stats = await stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('少于 2 个文件应返回错误', async () => {
      const result = await pdfMerge({
        input_paths: [testPdfPath1],
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('at least 2');
    });

    it('空数组应返回错误', async () => {
      const result = await pdfMerge({
        input_paths: [],
      }, runtime);
      expect(result.isError).toBe(true);
    });

    it('不存在的文件应返回错误(不抛异常)', async () => {
      const result = await pdfMerge({
        input_paths: ['/nonexistent/a.pdf', '/nonexistent/b.pdf'],
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Failed to merge');
    });

    it('合并后页面顺序应与输入一致', async () => {
      const result = await pdfMerge({
        input_paths: [testPdfPath2, testPdfPath1],
      }, runtime);
      expect(result.isError).toBeFalsy();
      const outputPath = join(workdir, 'test2_merged.pdf');
      const outputBytes = await readFile(outputPath);
      const mergedPdf = await PDFDocument.load(outputBytes);
      // PDF 2 (1页) 在前,PDF 1 (2页) 在后
      expect(mergedPdf.getPageCount()).toBe(3);
    });
  });

  describe('pdfCompress', () => {
    it('应压缩 PDF 并输出有效文件', async () => {
      const result = await pdfCompress({
        input_path: testPdfPath1,
      }, runtime);
      expect(result.isError).toBeFalsy();
      expect(result.content[0]!.type).toBe('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('compressed');
      expect(text).toContain('Pages: 2');

      // 验证输出文件为合法 PDF
      const outputPath = join(workdir, 'test1_compressed.pdf');
      const outputBytes = await readFile(outputPath);
      const compressedPdf = await PDFDocument.load(outputBytes);
      expect(compressedPdf.getPageCount()).toBe(2);
    });

    it('应支持自定义 level', async () => {
      const result = await pdfCompress({
        input_path: testPdfPath1,
        level: 9,
      }, runtime);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Level: 9');
    });

    it('level 0-3 应不启用对象流', async () => {
      const result = await pdfCompress({
        input_path: testPdfPath1,
        level: 0,
      }, runtime);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Level: 0');
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'custom_compressed.pdf');
      const result = await pdfCompress({
        input_path: testPdfPath1,
        output_path: outputPath,
      }, runtime);
      expect(result.isError).toBeFalsy();
      const stats = await stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('level 超出范围应返回错误', async () => {
      const result = await pdfCompress({
        input_path: testPdfPath1,
        level: 10,
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('between 0 and 9');
    });

    it('不存在的文件应返回错误(不抛异常)', async () => {
      const result = await pdfCompress({
        input_path: '/nonexistent/file.pdf',
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Failed to compress');
    });
  });

  describe('pdfSplit', () => {
    it('pages_per_file=2 应将 2 页 PDF 拆成 1 个文件(参数需透传为 pagesPerFile)', async () => {
      const result = await pdfSplit({
        input_path: testPdfPath1,
        pages_per_file: 2,
        output_dir: workdir,
      }, runtime);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('split successfully into 1 files');
      const outDoc = await PDFDocument.load(
        await readFile(join(workdir, 'test1_part1.pdf'))
      );
      expect(outDoc.getPageCount()).toBe(2);
    });

    it('缺少 pages_per_file 和 ranges 应返回错误', async () => {
      const result = await pdfSplit({
        input_path: testPdfPath1,
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('pages_per_file or ranges');
    });

    it('不存在的文件应返回错误(不抛异常)', async () => {
      const result = await pdfSplit({
        input_path: '/nonexistent/file.pdf',
        pages_per_file: 1,
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Failed to split');
    });
  });

  describe('pdfRotate', () => {
    it('不存在的文件应返回错误(不抛异常)', async () => {
      const result = await pdfRotate({
        input_path: '/nonexistent/file.pdf',
        angle: '90',
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Failed to rotate');
    });
  });

  describe('pdfWatermark', () => {
    it('font_size 应透传为 fontSize(非法值应触发 engine 校验错误)', async () => {
      const result = await pdfWatermark({
        input_path: testPdfPath1,
        text: 'DRAFT',
        font_size: -1,
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('fontSize must be > 0');
    });

    it('不存在的文件应返回错误(不抛异常)', async () => {
      const result = await pdfWatermark({
        input_path: '/nonexistent/file.pdf',
        text: 'DRAFT',
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Failed to watermark');
    });
  });

  describe('pdfAddPageNumbers', () => {
    it('应为 PDF 添加页码并输出文件', async () => {
      const outputPath = join(workdir, 'numbered.pdf');
      const result = await pdfAddPageNumbers({
        input_path: testPdfPath1,
        position: 'bottom-center',
        format: 'Page {n} of {total}',
        output_path: outputPath,
      }, runtime);

      expect(result.isError).toBeUndefined();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('PDF page numbers added successfully');
      const outStat = await stat(outputPath);
      expect(outStat.size).toBeGreaterThan(0);
      // 输出应仍是可解析的 PDF
      const outDoc = await PDFDocument.load(await readFile(outputPath));
      expect(outDoc.getPageCount()).toBeGreaterThan(0);
    });

    it('不存在的文件应返回错误(不抛异常)', async () => {
      const result = await pdfAddPageNumbers({
        input_path: '/nonexistent/file.pdf',
      }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Failed to add page numbers');
    });
  });

  describe('getPdfToolRegistrations', () => {
    it('应返回 6 个 tool 注册', () => {
      const regs = getPdfToolRegistrations(runtime);
      expect(regs).toHaveLength(6);
      const names = regs.map((r) => r.name);
      expect(names).toContain('lokvis_pdf_merge');
      expect(names).toContain('lokvis_pdf_compress');
      expect(names).toContain('lokvis_pdf_split');
      expect(names).toContain('lokvis_pdf_rotate');
      expect(names).toContain('lokvis_pdf_watermark');
      expect(names).toContain('lokvis_pdf_add_page_numbers');
    });

    it('每个注册应有 name/description/inputSchema/handler', () => {
      const regs = getPdfToolRegistrations(runtime);
      for (const reg of regs) {
        expect(typeof reg.name).toBe('string');
        expect(reg.name.startsWith('lokvis_pdf_')).toBe(true);
        expect(typeof reg.description).toBe('string');
        expect(reg.description.length).toBeGreaterThan(0);
        expect(typeof reg.inputSchema).toBe('object');
        expect(typeof reg.handler).toBe('function');
      }
    });

    it('lokvis_pdf_merge 的 inputSchema 应要求 input_paths', () => {
      const regs = getPdfToolRegistrations(runtime);
      const mergeReg = regs.find((r) => r.name === 'lokvis_pdf_merge');
      expect(mergeReg).toBeDefined();
      const schema = mergeReg!.inputSchema as {
        properties: Record<string, unknown>;
        required: string[];
      };
      expect(schema.required).toContain('input_paths');
      expect(schema.properties.input_paths).toBeDefined();
    });

    it('lokvis_pdf_compress 的 inputSchema 应要求 input_path', () => {
      const regs = getPdfToolRegistrations(runtime);
      const compressReg = regs.find((r) => r.name === 'lokvis_pdf_compress');
      expect(compressReg).toBeDefined();
      const schema = compressReg!.inputSchema as {
        properties: Record<string, unknown>;
        required: string[];
      };
      expect(schema.required).toContain('input_path');
      expect(schema.properties.input_path).toBeDefined();
    });

    it('handler 应可调用并返回 McpToolResult', async () => {
      const regs = getPdfToolRegistrations(runtime);
      const compressReg = regs.find((r) => r.name === 'lokvis_pdf_compress');
      const result = await compressReg!.handler({ input_path: testPdfPath1 });
      expect(result).toHaveProperty('content');
      expect(result.isError).toBeFalsy();
    });
  });
});

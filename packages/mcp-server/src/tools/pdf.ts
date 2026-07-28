/**
 * PDF tools:MCP tool handlers for PDF processing.
 *
 * 6 个 tool 经 runtime.run(workflow, inputs) 走完整 Capability 系统(TD-1.1 长期方案):
 * - lokvis_pdf_merge: 合并多个 PDF(pdf.merge,N→1)
 * - lokvis_pdf_compress: 压缩 PDF(pdf.compress,1→1)
 * - lokvis_pdf_split: 拆分 PDF(pdf.split,1→N)
 * - lokvis_pdf_rotate: 旋转页面(pdf.rotate,1→1)
 * - lokvis_pdf_watermark: 加水印(pdf.watermark,1→1)
 * - lokvis_pdf_add_page_numbers: 添加页码(pdf.add-page-numbers,1→1)
 *
 * 架构定位:mcp-server 通过 `runtime.run(workflow, inputs)` 走完整 capability
 * 系统(CapabilityRegistry.resolve → createMergeCapabilityImpl /
 * createBlobCapabilityImpl → engine operation),与浏览器侧
 * Runtime→Capability→Engine 链路完全对齐(ADR-011 / AGENTS.md 五层架构)。
 * pdf-lib engine 由 `@lokvis/plugin-pdf/node` 在 server.ts 启动时通过
 * `runtime.installPlugin(await pdfToolsPluginNode())` 注册。
 *
 * 页数读取:通过 runtime.readAssetPdfInfo() 读取输出 asset 的页数 ——
 * 走 MetadataReader 依赖反转(plugin-pdf/node 注册 'pdf.read-info' reader,
 * 内部调 engine-pdf 的 getPdfInfo),避免 mcp-server 直接依赖 engine-pdf
 * (五层架构单向依赖,见 A1 修复)。
 *
 * 输入:文件路径(绝对路径或相对 workdir)
 * 输出:处理后的文件路径 + 元数据(页数/大小变化)
 */

import { resolve, basename, join, dirname } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import type { LokvisRuntime } from '@lokvis/sdk';
import type { McpToolResult } from '../server.js';
import {
  blobToFile,
  makeOutputPath,
  getFileSize,
  formatSize,
} from './fs-helpers.js';
import {
  buildSingleTransformWorkflow,
  buildMergeWorkflow,
  buildSplitWorkflow,
} from './workflow-helpers.js';
import {
  pdfMergeSchema,
  pdfCompressSchema,
  pdfSplitSchema,
  pdfRotateSchema,
  pdfWatermarkSchema,
  pdfAddPageNumbersSchema,
  validateParams,
} from './schemas.js';

/** PDF 文件的 MIME 类型(构造输入 File 时使用) */
const PDF_MIME = 'application/pdf';

/**
 * 通用 pdf transform 流程:file → importAsset → runtime.run → exportAsset → cleanup。
 *
 * 走完整 capability 系统(TD-1.1 长期方案),与 image.ts 模式一致。
 * input/output asset 在流程结束后清理(避免 NodeAssetStore 累积)。
 *
 * 页数读取:通过 runtime.readAssetPdfInfo() 读取输出 asset 的页数 ——
 * 走 MetadataReader 依赖反转(plugin-pdf/node 注册 'pdf.read-info' reader,
 * 内部调 engine-pdf 的 getPdfInfo),避免 mcp-server 直接依赖 engine-pdf
 * (五层架构单向依赖,见 A1 修复)。
 */
async function runPdfTransform(
  runtime: LokvisRuntime,
  inputPaths: string[],
  capability: string,
  params: Record<string, unknown>,
  options: { merge: boolean }
): Promise<{ outBlob: Blob; pages: number | null }> {
  // 构造输入 File 并 importAsset
  const inputAssetIds: string[] = [];
  for (const p of inputPaths) {
    const buffer = await readFile(p);
    // AGENTS.md:Node.js 环境构造 File 对象用标准 API
    const file = new File([buffer], basename(p), { type: PDF_MIME });
    const id = await runtime.importAsset({ kind: 'file', file });
    inputAssetIds.push(id);
  }

  try {
    const workflow = options.merge
      ? buildMergeWorkflow(capability, params, 'pdf', 'pdf')
      : buildSingleTransformWorkflow(capability, params, 'pdf', 'pdf');
    const result = await runtime.run(workflow, inputAssetIds);
    if (result.status !== 'completed' || !result.outputs[0]) {
      throw new Error(
        `Workflow ${capability} failed: status=${result.status}` +
          (result.error ? ` error=${result.error}` : '')
      );
    }

    const outAssetId = result.outputs[0];
    const outBlob = await runtime.exportAsset(outAssetId);

    // 读取输出 asset 的页数(走 MetadataReader,失败时降级为 null,不影响主流程)
    // reader 未注册 / 解析失败均返回 null
    const info = await runtime.readAssetPdfInfo(outAssetId);
    const pages = info?.pages ?? null;

    // 清理 output asset(已导出 Blob,不再需要)。失败仅 warn,不影响主流程结果
    await runtime.removeAsset(outAssetId).catch((e) => {
      console.warn('[mcp-server] cleanup output asset failed:', e);
    });

    return { outBlob, pages };
  } finally {
    // 清理所有 input asset(避免 NodeAssetStore 累积)。失败仅 warn,不影响主流程结果
    for (const id of inputAssetIds) {
      await runtime.removeAsset(id).catch((e) => {
        console.warn('[mcp-server] cleanup input asset failed:', e);
      });
    }
  }
}

/**
 * lokvis_pdf_merge:合并多个 PDF 文件。
 *
 * 参数:
 * - input_paths: 输入 PDF 路径数组(必填,至少 2 个)
 * - output_path: 输出路径(可选,默认第一个文件加 _merged 后缀)
 */
export async function pdfMerge(
  params: {
    input_paths: string[];
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPaths = params.input_paths;
  if (!Array.isArray(inputPaths) || inputPaths.length < 2) {
    return {
      content: [
        { type: 'text', text: 'Error: input_paths must be an array with at least 2 PDF files' },
      ],
      isError: true,
    };
  }

  const resolvedPaths = inputPaths.map((p) => resolve(p));
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(resolvedPaths[0]!, 'merged', 'pdf');

  try {
    const inputSizes = await Promise.all(resolvedPaths.map(getFileSize));
    const totalInputSize = inputSizes.reduce((a, b) => a + b, 0);

    const { outBlob, pages } = await runPdfTransform(
      runtime,
      resolvedPaths,
      'pdf.merge',
      {},
      { merge: true }
    );
    await blobToFile(outBlob, outputPath);

    const outputSize = await getFileSize(outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF merged successfully.`,
            `  Inputs: ${resolvedPaths.length} files (${formatSize(totalInputSize)} total)`,
            ...resolvedPaths.map((p, i) => `    - ${p} (${formatSize(inputSizes[i]!)})`),
            `  Output: ${outputPath} (${formatSize(outputSize)})`,
            `  Pages: ${pages ?? 'unknown'}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to merge PDFs: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_pdf_compress:压缩 PDF。
 *
 * 参数:
 * - input_path: 输入 PDF 路径(必填)
 * - level: 压缩级别 0-9(可选,默认 6;pdf-lib 通过对象流压缩实现)
 * - output_path: 输出路径(可选,默认输入路径加 _compressed 后缀)
 *
 * 注意:pdf-lib 的压缩能力有限(主要是对象流压缩 + 移除冗余)。
 * 深度压缩(图片降采样)需要 ghostscript 等外部工具,留待后续。
 */
export async function pdfCompress(
  params: {
    input_path: string;
    level?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const level = params.level ?? 6;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'compressed', 'pdf');

  if (level < 0 || level > 9) {
    return {
      content: [
        { type: 'text', text: 'Error: level must be between 0 and 9' },
      ],
      isError: true,
    };
  }

  try {
    const originalSize = await getFileSize(inputPath);

    const { outBlob, pages } = await runPdfTransform(
      runtime,
      [inputPath],
      'pdf.compress',
      { level },
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    const ratio = ((1 - outBlob.size / originalSize) * 100).toFixed(1);

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF compressed successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Level: ${level}`,
            `  Pages: ${pages ?? 'unknown'}`,
            `  Saved: ${ratio}% (${formatSize(originalSize - outBlob.size)})`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to compress PDF: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * Split 专用 transform 流程:与 runPdfTransform 类似,但导出 ALL outputs(1→N)。
 *
 * pdf.split capability 执行后 result.outputs 包含 N 个 asset ID,
 * 每个对应一个拆分后的 PDF 文件。
 */
async function runPdfSplitTransform(
  runtime: LokvisRuntime,
  inputPath: string,
  params: Record<string, unknown>
): Promise<{ outBlobs: Blob[]; pages: (number | null)[] }> {
  const buffer = await readFile(inputPath);
  const file = new File([buffer], basename(inputPath), { type: PDF_MIME });
  const inputAssetId = await runtime.importAsset({ kind: 'file', file });

  try {
    const workflow = buildSplitWorkflow('pdf.split', params, 'pdf', 'pdf');
    const result = await runtime.run(workflow, [inputAssetId]);
    if (result.status !== 'completed' || result.outputs.length === 0) {
      throw new Error(
        `Workflow pdf.split failed: status=${result.status}` +
          (result.error ? ` error=${result.error}` : '')
      );
    }

    const outBlobs: Blob[] = [];
    const pages: (number | null)[] = [];
    for (const outAssetId of result.outputs) {
      const outBlob = await runtime.exportAsset(outAssetId);
      outBlobs.push(outBlob);
      const info = await runtime.readAssetPdfInfo(outAssetId);
      pages.push(info?.pages ?? null);
      await runtime.removeAsset(outAssetId).catch((e) => {
        console.warn('[mcp-server] cleanup output asset failed:', e);
      });
    }

    return { outBlobs, pages };
  } finally {
    await runtime.removeAsset(inputAssetId).catch((e) => {
      console.warn('[mcp-server] cleanup input asset failed:', e);
    });
  }
}

/**
 * lokvis_pdf_split:拆分 PDF 为多个文件。
 *
 * 参数:
 * - input_path: 输入 PDF 路径(必填)
 * - pages_per_file: 每个文件的页数(可选,与 ranges 二选一)
 * - ranges: 页码范围数组(可选,如 [[1,3],[4,6]])
 * - output_dir: 输出目录(可选,默认输入文件所在目录)
 */
export async function pdfSplit(
  params: {
    input_path: string;
    pages_per_file?: number;
    ranges?: Array<[number, number]>;
    output_dir?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputDir = params.output_dir
    ? resolve(params.output_dir)
    : dirname(inputPath);

  if (!params.pages_per_file && !params.ranges) {
    return {
      content: [
        { type: 'text', text: 'Error: either pages_per_file or ranges must be specified' },
      ],
      isError: true,
    };
  }

  try {
    const originalSize = await getFileSize(inputPath);
    await mkdir(outputDir, { recursive: true });

    const transformParams: Record<string, unknown> = {};
    if (params.pages_per_file) transformParams.pagesPerFile = params.pages_per_file;
    if (params.ranges) transformParams.ranges = params.ranges;

    const { outBlobs, pages } = await runPdfSplitTransform(
      runtime,
      inputPath,
      transformParams
    );

    const baseName = basename(inputPath, '.pdf');
    const outputPaths: string[] = [];
    for (let i = 0; i < outBlobs.length; i++) {
      const outPath = join(outputDir, `${baseName}_part${i + 1}.pdf`);
      await blobToFile(outBlobs[i]!, outPath);
      outputPaths.push(outPath);
    }

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF split successfully into ${outBlobs.length} files.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output directory: ${outputDir}`,
            ...outputPaths.map((p, i) => `    - ${p} (${pages[i] ?? '?'} pages)`),
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to split PDF: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_pdf_rotate:旋转 PDF 页面。
 *
 * 参数:
 * - input_path: 输入 PDF 路径(必填)
 * - angle: 旋转角度 90/180/270(必填)
 * - pages: 要旋转的页索引数组(可选,默认全部页面)
 * - output_path: 输出路径(可选)
 */
export async function pdfRotate(
  params: {
    input_path: string;
    angle: '90' | '180' | '270';
    pages?: number[];
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'rotated', 'pdf');

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = {
      angle: Number(params.angle),
    };
    if (params.pages) transformParams.pages = params.pages;

    const { outBlob, pages } = await runPdfTransform(
      runtime,
      [inputPath],
      'pdf.rotate',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF rotated successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Angle: ${params.angle}°`,
            `  Pages: ${pages ?? 'unknown'}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to rotate PDF: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_pdf_watermark:为 PDF 添加文字水印。
 *
 * 参数:
 * - input_path: 输入 PDF 路径(必填)
 * - text: 水印文字(必填)
 * - opacity: 透明度 0-1(可选,默认 0.3)
 * - font_size: 字体大小(可选,默认 36)
 * - color: 颜色(可选,默认 '#888888')
 * - output_path: 输出路径(可选)
 */
export async function pdfWatermark(
  params: {
    input_path: string;
    text: string;
    opacity?: number;
    font_size?: number;
    color?: string;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'watermarked', 'pdf');

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = {
      text: params.text,
    };
    if (params.opacity !== undefined) transformParams.opacity = params.opacity;
    if (params.font_size !== undefined) transformParams.fontSize = params.font_size;
    if (params.color !== undefined) transformParams.color = params.color;

    const { outBlob, pages } = await runPdfTransform(
      runtime,
      [inputPath],
      'pdf.watermark',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF watermarked successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Text: "${params.text}"`,
            `  Pages: ${pages ?? 'unknown'}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to watermark PDF: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_pdf_add_page_numbers:为 PDF 添加页码。
 *
 * 参数:
 * - input_path: 输入 PDF 路径(必填)
 * - position: 页码位置(可选,默认 'bottom-center')
 * - format: 格式模板,支持 {n} / {total} 占位符(可选,默认 'Page {n} of {total}')
 * - start_from: 起始页码(可选,默认 1)
 * - font_size: 字体大小(可选,默认 10)
 * - color: 颜色(可选,默认 '#666666')
 * - output_path: 输出路径(可选)
 */
export async function pdfAddPageNumbers(
  params: {
    input_path: string;
    position?: 'bottom-center' | 'bottom-right' | 'top-center' | 'top-right';
    format?: string;
    start_from?: number;
    font_size?: number;
    color?: string;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'numbered', 'pdf');

  try {
    const originalSize = await getFileSize(inputPath);

    // engine-pdf addPageNumbers 参数为 camelCase
    const transformParams: Record<string, unknown> = {};
    if (params.position !== undefined) transformParams.position = params.position;
    if (params.format !== undefined) transformParams.format = params.format;
    if (params.start_from !== undefined) transformParams.startFrom = params.start_from;
    if (params.font_size !== undefined) transformParams.fontSize = params.font_size;
    if (params.color !== undefined) transformParams.color = params.color;

    const { outBlob, pages } = await runPdfTransform(
      runtime,
      [inputPath],
      'pdf.add-page-numbers',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF page numbers added successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Position: ${params.position ?? 'bottom-center'}`,
            `  Format: "${params.format ?? 'Page {n} of {total}'}"`,
            `  Pages: ${pages ?? 'unknown'}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to add page numbers to PDF: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * 注册 PDF tools 到 MCP server adapter。
 *
 * Tool 命名遵循 manifest 约定:`lokvis_${capability.replace(/\./g, '_')}`
 * - pdf.merge → lokvis_pdf_merge
 * - pdf.compress → lokvis_pdf_compress
 * - pdf.split → lokvis_pdf_split
 * - pdf.rotate → lokvis_pdf_rotate
 * - pdf.watermark → lokvis_pdf_watermark
 * - pdf.add-page-numbers → lokvis_pdf_add_page_numbers
 *
 * @param runtime Lokvis Runtime(已安装 pdfToolsPluginNode,注册 pdf capabilities)
 */
export function getPdfToolRegistrations(runtime: LokvisRuntime): Array<{
  name: string;
  description: string;
  inputSchema: object;
  handler: (params: Record<string, unknown>) => Promise<McpToolResult>;
}> {
  return [
    {
      name: 'lokvis_pdf_merge',
      description:
        'Merge multiple PDF files into a single PDF. ' +
        'Files are merged in the order specified in input_paths.',
      inputSchema: {
        type: 'object',
        properties: {
          input_paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of paths to PDF files to merge (minimum 2)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to first_input_merged.pdf)',
          },
        },
        required: ['input_paths'],
      },
      handler: async (p) => {
        const r = validateParams(pdfMergeSchema, p);
        if (!r.success) return r.error;
        return pdfMerge(r.data, runtime);
      },
    },
    {
      name: 'lokvis_pdf_compress',
      description:
        'Compress a PDF to reduce file size. ' +
        'Uses object stream compression (level 4-9) for better compression.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input PDF file',
          },
          level: {
            type: 'number',
            minimum: 0,
            maximum: 9,
            description: 'Compression level 0-9 (default: 6; 4+ enables object streams)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_compressed.pdf)',
          },
        },
        required: ['input_path'],
      },
      handler: async (p) => {
        const r = validateParams(pdfCompressSchema, p);
        if (!r.success) return r.error;
        return pdfCompress(r.data, runtime);
      },
    },
    {
      name: 'lokvis_pdf_split',
      description:
        'Split a PDF into multiple files. ' +
        'Specify pages_per_file for equal splits or ranges for custom page ranges.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input PDF file',
          },
          pages_per_file: {
            type: 'number',
            description: 'Number of pages per output file (mutually exclusive with ranges)',
          },
          ranges: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2,
            },
            description: 'Page ranges as [start, end] tuples (1-indexed, inclusive)',
          },
          output_dir: {
            type: 'string',
            description: 'Output directory (optional, defaults to input file directory)',
          },
        },
        required: ['input_path'],
      },
      handler: async (p) => {
        const r = validateParams(pdfSplitSchema, p);
        if (!r.success) return r.error;
        return pdfSplit(r.data, runtime);
      },
    },
    {
      name: 'lokvis_pdf_rotate',
      description:
        'Rotate pages in a PDF by 90, 180, or 270 degrees. ' +
        'Optionally specify which pages to rotate.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input PDF file',
          },
          angle: {
            type: 'string',
            enum: ['90', '180', '270'],
            description: 'Rotation angle in degrees',
          },
          pages: {
            type: 'array',
            items: { type: 'number' },
            description: 'Page indices to rotate (0-indexed; optional, defaults to all pages)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_rotated.pdf)',
          },
        },
        required: ['input_path', 'angle'],
      },
      handler: async (p) => {
        const r = validateParams(pdfRotateSchema, p);
        if (!r.success) return r.error;
        return pdfRotate(r.data, runtime);
      },
    },
    {
      name: 'lokvis_pdf_watermark',
      description:
        'Add a text watermark to all pages of a PDF. ' +
        'Customize opacity, font size, and color.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input PDF file',
          },
          text: {
            type: 'string',
            description: 'Watermark text to add',
          },
          opacity: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Watermark opacity 0-1 (default: 0.3)',
          },
          font_size: {
            type: 'number',
            description: 'Font size for the watermark text (default: 36)',
          },
          color: {
            type: 'string',
            description: 'Watermark color as hex string (default: #888888)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_watermarked.pdf)',
          },
        },
        required: ['input_path', 'text'],
      },
      handler: async (p) => {
        const r = validateParams(pdfWatermarkSchema, p);
        if (!r.success) return r.error;
        return pdfWatermark(r.data, runtime);
      },
    },
    {
      name: 'lokvis_pdf_add_page_numbers',
      description:
        'Add page numbers to all pages of a PDF. ' +
        'Customize position, format template ({n}/{total}), start number, font size, and color.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input PDF file',
          },
          position: {
            type: 'string',
            enum: ['bottom-center', 'bottom-right', 'top-center', 'top-right'],
            description: 'Page number position (default: bottom-center)',
          },
          format: {
            type: 'string',
            description:
              'Format template with {n} (current page) and {total} placeholders (default: "Page {n} of {total}")',
          },
          start_from: {
            type: 'number',
            minimum: 1,
            description: 'Starting page number (default: 1)',
          },
          font_size: {
            type: 'number',
            description: 'Font size for the page numbers (default: 10)',
          },
          color: {
            type: 'string',
            description: 'Page number color as hex string (default: #666666)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_numbered.pdf)',
          },
        },
        required: ['input_path'],
      },
      handler: async (p) => {
        const r = validateParams(pdfAddPageNumbersSchema, p);
        if (!r.success) return r.error;
        return pdfAddPageNumbers(r.data, runtime);
      },
    },
  ];
}

/**
 * PDF tools:MCP tool handlers for PDF processing.
 *
 * 2 个 tool 经 @lokvis/engine-pdf(Engine 层,Blob↔Blob 纯函数)处理本地 PDF 文件:
 * - lokvis_pdf_merge: 合并多个 PDF
 * - lokvis_pdf_compress: 压缩 PDF(移除冗余对象 + 对象流压缩)
 *
 * 架构定位:mcp-server 是 Node 应用,直接消费 Engine 层 Blob↔Blob 操作
 * (与 image.ts 一致;与浏览器侧 Runtime→Capability→Engine 链路对齐:Node 侧
 *  无需 Asset/Workflow 抽象,tool handler 自行做 file-path ↔ Blob 翻译)。
 * pdf-lib 仅在 engine-pdf 内使用,本文件不直接 import pdf-lib
 * (ADR-011 / AGENTS.md 五层架构)。engine-pdf 的 PdfEngineAdapter 仍为 stub
 * (能力系统绑定),此处的独立 operations 是已实装的 Blob↔Blob 实现,
 * 供不经能力系统的 Node 消费方直接调用(见 TD-1.4 长期方案)。
 *
 * 输入:文件路径(绝对路径或相对 workdir)
 * 输出:处理后的文件路径 + 元数据(页数/大小变化)
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join } from 'node:path';
import {
  mergePdfs as engineMergePdfs,
  compressPdf as engineCompressPdf,
  getPdfInfo,
} from '@lokvis/engine-pdf';
import type { McpToolResult } from '../server.js';

/** PDF 文件的 MIME 类型(构造输入 Blob 时使用) */
const PDF_MIME = 'application/pdf';

/** 读取文件为 Blob(带 PDF MIME) */
async function fileToBlob(path: string): Promise<Blob> {
  const buffer = await readFile(path);
  return new Blob([buffer], { type: PDF_MIME });
}

/** 把 Blob 写入文件 */
async function blobToFile(blob: Blob, path: string): Promise<void> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  await writeFile(path, buffer);
}

/** 生成输出路径:输入路径加后缀 */
function makeOutputPath(
  inputPath: string,
  suffix: string,
  newExt?: string
): string {
  const dir = dirname(inputPath);
  const base = basename(inputPath, extname(inputPath));
  const ext = newExt || extname(inputPath).slice(1) || 'pdf';
  return join(dir, `${base}_${suffix}.${ext}`);
}

/** 获取文件大小(字节) */
async function getFileSize(path: string): Promise<number> {
  const stats = await stat(path);
  return stats.size;
}

/** 格式化文件大小(人类可读) */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/**
 * lokvis_pdf_merge:合并多个 PDF 文件。
 *
 * 参数:
 * - input_paths: 输入 PDF 路径数组(必填,至少 2 个)
 * - output_path: 输出路径(可选,默认第一个文件加 _merged 后缀)
 */
export async function pdfMerge(params: {
  input_paths: string[];
  output_path?: string;
}): Promise<McpToolResult> {
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
    : makeOutputPath(resolvedPaths[0]!, 'merged');

  try {
    const inputBlobs = await Promise.all(resolvedPaths.map(fileToBlob));
    const outBlob = await engineMergePdfs(inputBlobs);
    await blobToFile(outBlob, outputPath);

    const inputSizes = await Promise.all(resolvedPaths.map(getFileSize));
    const totalInputSize = inputSizes.reduce((a, b) => a + b, 0);
    const outputSize = await getFileSize(outputPath);
    const info = await getPdfInfo(outBlob);

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF merged successfully.`,
            `  Inputs: ${resolvedPaths.length} files (${formatSize(totalInputSize)} total)`,
            ...resolvedPaths.map((p, i) => `    - ${p} (${formatSize(inputSizes[i]!)})`),
            `  Output: ${outputPath} (${formatSize(outputSize)})`,
            `  Pages: ${info.pages}`,
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
export async function pdfCompress(params: {
  input_path: string;
  level?: number;
  output_path?: string;
}): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const level = params.level ?? 6;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'compressed');

  if (level < 0 || level > 9) {
    return {
      content: [
        { type: 'text', text: 'Error: level must be between 0 and 9' },
      ],
      isError: true,
    };
  }

  try {
    const inputBlob = await fileToBlob(inputPath);
    const outBlob = await engineCompressPdf(inputBlob, { level });
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);
    const ratio = ((1 - outBlob.size / originalSize) * 100).toFixed(1);
    const info = await getPdfInfo(outBlob);

    return {
      content: [
        {
          type: 'text',
          text: [
            `PDF compressed successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Level: ${level}`,
            `  Pages: ${info.pages}`,
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
 * 注册 PDF tools 到 MCP server adapter。
 *
 * Tool 命名遵循 manifest 约定:`lokvis_${capability.replace(/\./g, '_')}`
 * - pdf.merge → lokvis_pdf_merge
 * - pdf.compress → lokvis_pdf_compress
 */
export function getPdfToolRegistrations(): Array<{
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
      handler: (p) =>
        pdfMerge(p as Parameters<typeof pdfMerge>[0]),
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
      handler: (p) =>
        pdfCompress(p as Parameters<typeof pdfCompress>[0]),
    },
  ];
}

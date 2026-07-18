/**
 * PDF tools:MCP tool handlers for PDF processing.
 *
 * 2 个 tool 经 runtime.run(workflow, inputs) 走完整 Capability 系统(TD-1.1 长期方案):
 * - lokvis_pdf_merge: 合并多个 PDF(pdf.merge,N→1)
 * - lokvis_pdf_compress: 压缩 PDF(pdf.compress,1→1)
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

import { resolve, basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { LokvisRuntime } from '@lokvis/sdk';
import type { Workflow } from '@lokvis/schema';
import type { McpToolResult } from '../server.js';
import {
  blobToFile,
  makeOutputPath,
  getFileSize,
  formatSize,
} from './fs-helpers.js';

/** PDF 文件的 MIME 类型(构造输入 File 时使用) */
const PDF_MIME = 'application/pdf';

/**
 * 构造单节点 transform Workflow(MCP tool 调用专用,1→1 形态)。
 *
 * 与 image.ts 的 buildSingleTransformWorkflow 一致,把单次 capability 调用
 * 包装为单节点 Workflow,经 runtime.run() 走完整 capability 系统。
 */
function buildSingleTransformWorkflow(
  capability: string,
  params: Record<string, unknown>
): Workflow {
  return {
    id: `mcp_${capability.replace(/\./g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0',
    name: capability,
    description: `MCP tool: ${capability}`,
    author: { id: 'mcp-server', name: 'MCP Server' },
    category: 'pdf',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability,
        params,
      },
    ],
    edges: [],
    inputs: { type: 'pdf', multiple: false },
    outputs: { type: 'pdf' },
  };
}

/**
 * 构造 merge(N→1)Workflow(MCP tool 调用专用)。
 *
 * 与 single transform 区别:inputs.multiple=true,允许 N 个输入;
 * runtime 会把 N 个 inputs 一次性传给 merge capability 的 execute。
 */
function buildMergeWorkflow(
  capability: string,
  params: Record<string, unknown>
): Workflow {
  return {
    id: `mcp_${capability.replace(/\./g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0',
    name: capability,
    description: `MCP tool: ${capability}`,
    author: { id: 'mcp-server', name: 'MCP Server' },
    category: 'pdf',
    tags: [],
    nodes: [
      {
        id: 'n1',
        type: 'transform',
        capability,
        params,
      },
    ],
    edges: [],
    inputs: { type: 'pdf', multiple: true },
    outputs: { type: 'pdf' },
  };
}

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
      ? buildMergeWorkflow(capability, params)
      : buildSingleTransformWorkflow(capability, params);
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
 * 注册 PDF tools 到 MCP server adapter。
 *
 * Tool 命名遵循 manifest 约定:`lokvis_${capability.replace(/\./g, '_')}`
 * - pdf.merge → lokvis_pdf_merge
 * - pdf.compress → lokvis_pdf_compress
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
      handler: (p) =>
        pdfMerge(
          p as Parameters<typeof pdfMerge>[0],
          runtime
        ),
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
        pdfCompress(
          p as Parameters<typeof pdfCompress>[0],
          runtime
        ),
    },
  ];
}

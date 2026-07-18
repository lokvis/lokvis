/**
 * Image tools:MCP tool handlers for image processing.
 *
 * 5 个 tool 经 runtime capability 系统调用(TD-1.1 长期方案):
 * - lokvis_image_resize: 调整尺寸(image.resize)
 * - lokvis_image_compress: 压缩(image.compress)
 * - lokvis_image_convert: 格式转换(image.convert)
 * - lokvis_image_crop: 裁剪(image.crop)
 * - lokvis_image_watermark: 水印(image.watermark)
 *
 * 架构定位:mcp-server 通过 `runtime.run(workflow, inputs)` 走完整 capability
 * 系统(CapabilityRegistry.resolve → createBlobCapabilityImpl → engine operation),
 * 与浏览器侧 Runtime→Capability→Engine 链路完全对齐(ADR-011 / AGENTS.md 五层架构)。
 * sharp engine 由 `@lokvis/plugin-image/node` 在 server.ts 启动时通过
 * `runtime.installPlugin(await imageToolsPluginNode())` 注册,本文件不直接
 * import sharp 或 @lokvis/engine-image/node(五层架构单向依赖)。
 *
 * 输入:文件路径(绝对路径或相对 workdir)
 * 输出:处理后的文件路径 + 元数据(尺寸/大小变化)
 */

import { resolve, extname, basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { LokvisRuntime, ImageMetadata } from '@lokvis/sdk';
import type { Workflow } from '@lokvis/schema';
import type { ImageWatermarkPosition } from '@lokvis/capability';
import type { McpToolResult } from '../server.js';
import {
  blobToFile,
  makeOutputPath,
  getFileSize,
  formatSize,
} from './fs-helpers.js';

/** 文件扩展名 → MIME 类型(构造输入 File 时使用,runtime 据此推断格式) */
const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

/** 从文件路径扩展名推断 MIME */
function extToMime(path: string): string {
  const ext = extname(path).slice(1).toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
}

/** 水印位置(从 capability manifest 派生,避免本地复制漂移) */
type WatermarkPosition = ImageWatermarkPosition;

/**
 * 构造单节点 transform Workflow(MCP tool 调用专用)。
 *
 * MCP tool 把单次 capability 调用包装为单节点 Workflow,经 runtime.run()
 * 走完整 capability 系统。与浏览器侧 Runtime→Capability→Engine 链路对齐。
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
    category: 'image',
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
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  };
}

/**
 * 通用 image transform 流程:file → importAsset → runtime.run → exportAsset → cleanup。
 *
 * 走完整 capability 系统(TD-1.1 长期方案),与浏览器侧 Runtime→Capability→Engine
 * 链路对齐。input/output asset 在流程结束后清理(避免 NodeAssetStore 累积)。
 *
 * dimensions 读取:Node 环境 createImageBitmap 不可用,runtime.importAsset 无法
 * 提取图像 dimensions(asset-store.ts 的 extractImageDimensions 降级为空)。
 * 此处通过 runtime.readAssetImageMetadata() 读取输出 asset 的 dimensions ——
 * 走 MetadataReader 依赖反转(plugin-image/node 注册 'image.read-metadata' reader,
 * 内部调 engine-image/node 的 getMetadata),避免 mcp-server 直接依赖 engine-image
 * (五层架构单向依赖,见 A1 修复)。
 */
async function runImageTransform(
  runtime: LokvisRuntime,
  inputPath: string,
  capability: string,
  params: Record<string, unknown>
): Promise<{ outBlob: Blob; outMeta: ImageMetadata | null }> {
  const mime = extToMime(inputPath);
  const buffer = await readFile(inputPath);
  // AGENTS.md:Node.js 环境构造 File 对象用标准 API
  const file = new File([buffer], basename(inputPath), { type: mime });
  const inputAssetId = await runtime.importAsset({ kind: 'file', file });

  try {
    const workflow = buildSingleTransformWorkflow(capability, params);
    const result = await runtime.run(workflow, [inputAssetId]);
    if (result.status !== 'completed' || !result.outputs[0]) {
      throw new Error(
        `Workflow ${capability} failed: status=${result.status}` +
          (result.error ? ` error=${result.error}` : '')
      );
    }

    const outAssetId = result.outputs[0];
    const outBlob = await runtime.exportAsset(outAssetId);

    // 读取输出 asset 的 dimensions/format(走 MetadataReader,失败时降级为 null)
    // reader 未注册 / 解析失败均返回 null,不影响主流程
    const outMeta = await runtime.readAssetImageMetadata(outAssetId);

    // 清理 output asset(已导出 Blob,不再需要)。失败仅 warn,不影响主流程结果
    await runtime.removeAsset(outAssetId).catch((e) => {
      console.warn('[mcp-server] cleanup output asset failed:', e);
    });

    return { outBlob, outMeta };
  } finally {
    // 清理 input asset(避免 NodeAssetStore 累积)。失败仅 warn,不影响主流程结果
    await runtime.removeAsset(inputAssetId).catch((e) => {
      console.warn('[mcp-server] cleanup input asset failed:', e);
    });
  }
}

/** 从 ImageMetadata 格式化为 "WxH" 字符串 */
function formatDimensions(meta: ImageMetadata | null): string {
  return meta ? `${meta.width}x${meta.height}` : 'unknown';
}

/**
 * lokvis_image_resize:调整图片尺寸。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - width: 目标宽度(可选,不指定则按 height 等比缩放)
 * - height: 目标高度(可选,不指定则按 width 等比缩放)
 * - fit: 缩放策略 'cover'|'contain'|'fill'(可选,默认 'cover')
 * - output_path: 输出路径(可选,默认输入路径加 _resized 后缀)
 */
export async function imageResize(
  params: {
    input_path: string;
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const width = params.width;
  const height = params.height;
  const fit = params.fit ?? 'cover';
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'resized', 'png');

  if (!width && !height) {
    return {
      content: [
        { type: 'text', text: 'Error: at least one of width or height must be specified' },
      ],
      isError: true,
    };
  }

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.resize',
      { width, height, fit }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image resized successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
            `  Format: ${outMeta?.format ?? 'unknown'}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to resize image: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_compress:压缩图片。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - quality: 压缩质量 1-100(可选,默认 80)
 * - output_path: 输出路径(可选,默认输入路径加 _compressed 后缀)
 *
 * 注意:保持输入格式(png/jpeg/webp/avif),按 quality 压缩。
 */
export async function imageCompress(
  params: {
    input_path: string;
    quality?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const quality = params.quality ?? 80;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'compressed', 'png');

  if (quality < 1 || quality > 100) {
    return {
      content: [
        { type: 'text', text: 'Error: quality must be between 1 and 100' },
      ],
      isError: true,
    };
  }

  try {
    // 保持输入格式:从扩展名推断 format 传给 capability
    const inputExt = extname(inputPath).slice(1).toLowerCase();
    const format = (EXT_TO_MIME[inputExt]?.split('/')[1] ?? 'webp') as
      | 'png' | 'jpeg' | 'webp' | 'avif' | 'gif';
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.compress',
      { format, quality }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);
    const ratio = ((1 - outBlob.size / originalSize) * 100).toFixed(1);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image compressed successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Quality: ${quality}%`,
            `  Saved: ${ratio}% (${formatSize(originalSize - outBlob.size)})`,
            `  Format: ${outMeta?.format ?? 'unknown'}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to compress image: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_convert:图片格式转换。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - format: 目标格式 'jpeg'|'png'|'webp'|'avif'(必填)
 * - quality: 质量 1-100(可选,仅对有损格式生效,默认 90)
 * - output_path: 输出路径(可选,默认输入路径加 _converted.<ext>)
 */
export async function imageConvert(
  params: {
    input_path: string;
    format: 'jpeg' | 'png' | 'webp' | 'avif';
    quality?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const format = params.format;
  const quality = params.quality ?? 90;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'converted', 'png', format);

  const validFormats = ['jpeg', 'png', 'webp', 'avif'];
  if (!validFormats.includes(format)) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: format must be one of ${validFormats.join(', ')}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.convert',
      { format, quality }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image converted successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${outMeta?.format ?? 'unknown'}, ${formatSize(outBlob.size)})`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to convert image: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_crop:裁剪图片(提取矩形区域)。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - x: 裁剪区域左上角 x 坐标(必填)
 * - y: 裁剪区域左上角 y 坐标(必填)
 * - width: 裁剪区域宽度(必填)
 * - height: 裁剪区域高度(必填)
 * - output_path: 输出路径(可选,默认输入路径加 _cropped 后缀)
 */
export async function imageCrop(
  params: {
    input_path: string;
    x: number;
    y: number;
    width: number;
    height: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const { x, y, width, height } = params;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'cropped', 'png');

  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    return {
      content: [
        { type: 'text', text: 'Error: x, y, width, height must all be numbers' },
      ],
      isError: true,
    };
  }
  if (width <= 0 || height <= 0) {
    return {
      content: [
        { type: 'text', text: 'Error: width and height must be positive' },
      ],
      isError: true,
    };
  }

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.crop',
      { x, y, width, height }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image cropped successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Region: (${x}, ${y}) ${width}x${height}`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to crop image: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_watermark:添加水印(文字或图片)。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - text: 水印文字(与 image 二选一)
 * - image: 水印图片 URL(data URL 或 http(s) URL,Node 端做 SSRF 校验)
 * - position: 水印位置 'top-left'|'top-right'|'bottom-left'|'bottom-right'|'center'|'tile'(默认 'bottom-right')
 * - opacity: 透明度 0-1(默认 0.8)
 * - fontSize: 字体大小(默认 24,仅文字水印生效)
 * - color: 颜色(默认 '#ffffff',仅文字水印生效)
 * - output_path: 输出路径(可选,默认输入路径加 _watermarked 后缀)
 */
export async function imageWatermark(
  params: {
    input_path: string;
    text?: string;
    image?: string;
    position?: WatermarkPosition;
    opacity?: number;
    fontSize?: number;
    color?: string;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'watermarked', 'png');

  if (!params.text && !params.image) {
    return {
      content: [
        { type: 'text', text: 'Error: at least one of text or image must be specified' },
      ],
      isError: true,
    };
  }

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.watermark',
      {
        text: params.text,
        image: params.image,
        position: params.position ?? 'bottom-right',
        opacity: params.opacity ?? 0.8,
        fontSize: params.fontSize ?? 24,
        color: params.color ?? '#ffffff',
      }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image watermarked successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Watermark: ${params.image ? `image(${params.image})` : `text("${params.text}")`}`,
            `  Position: ${params.position ?? 'bottom-right'}`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to watermark image: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * 注册 image tools 到 MCP server adapter。
 *
 * Tool 命名遵循 manifest 约定:`lokvis_${capability.replace(/\./g, '_')}`
 * - image.resize → lokvis_image_resize
 * - image.compress → lokvis_image_compress
 * - image.convert → lokvis_image_convert
 * - image.crop → lokvis_image_crop
 * - image.watermark → lokvis_image_watermark
 *
 * @param runtime Lokvis Runtime(已安装 imageToolsPluginNode,注册 image capabilities)
 */
export function getImageToolRegistrations(runtime: LokvisRuntime): Array<{
  name: string;
  description: string;
  inputSchema: object;
  handler: (params: Record<string, unknown>) => Promise<McpToolResult>;
}> {
  return [
    {
      name: 'lokvis_image_resize',
      description:
        'Resize an image to specified width and/or height. ' +
        'If only one dimension is specified, the other is scaled proportionally.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input image file',
          },
          width: {
            type: 'number',
            description: 'Target width in pixels (optional, scales proportionally if omitted)',
          },
          height: {
            type: 'number',
            description: 'Target height in pixels (optional, scales proportionally if omitted)',
          },
          fit: {
            type: 'string',
            enum: ['cover', 'contain', 'fill', 'inside', 'outside'],
            description: 'Resize strategy (default: cover)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_resized.<ext>)',
          },
        },
        required: ['input_path'],
      },
      handler: (p) =>
        imageResize(
          p as Parameters<typeof imageResize>[0],
          runtime
        ),
    },
    {
      name: 'lokvis_image_compress',
      description:
        'Compress an image to reduce file size. ' +
        'Supports JPEG, PNG, WebP, and AVIF formats.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input image file',
          },
          quality: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            description: 'Compression quality 1-100 (default: 80)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_compressed.<ext>)',
          },
        },
        required: ['input_path'],
      },
      handler: (p) =>
        imageCompress(
          p as Parameters<typeof imageCompress>[0],
          runtime
        ),
    },
    {
      name: 'lokvis_image_convert',
      description:
        'Convert an image to a different format (jpeg, png, webp, or avif).',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input image file',
          },
          format: {
            type: 'string',
            enum: ['jpeg', 'png', 'webp', 'avif'],
            description: 'Target format',
          },
          quality: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            description: 'Quality for lossy formats (default: 90)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_converted.<format>)',
          },
        },
        required: ['input_path', 'format'],
      },
      handler: (p) =>
        imageConvert(
          p as Parameters<typeof imageConvert>[0],
          runtime
        ),
    },
    {
      name: 'lokvis_image_crop',
      description:
        'Crop an image to extract a rectangular region. ' +
        'Specify the top-left corner (x, y) and the region size (width, height).',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input image file',
          },
          x: {
            type: 'number',
            description: 'X coordinate of the top-left corner of the crop region',
          },
          y: {
            type: 'number',
            description: 'Y coordinate of the top-left corner of the crop region',
          },
          width: {
            type: 'number',
            description: 'Width of the crop region in pixels',
          },
          height: {
            type: 'number',
            description: 'Height of the crop region in pixels',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_cropped.<ext>)',
          },
        },
        required: ['input_path', 'x', 'y', 'width', 'height'],
      },
      handler: (p) =>
        imageCrop(
          p as Parameters<typeof imageCrop>[0],
          runtime
        ),
    },
    {
      name: 'lokvis_image_watermark',
      description:
        'Add a watermark to an image (text or image watermark). ' +
        'Supports 9-grid positions and tile mode. ' +
        'Either text or image must be provided.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input image file',
          },
          text: {
            type: 'string',
            description: 'Watermark text (required if image is not provided)',
          },
          image: {
            type: 'string',
            description: 'Watermark image URL (data URL or http(s) URL; required if text is not provided)',
          },
          position: {
            type: 'string',
            enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'tile'],
            description: 'Watermark position (default: bottom-right)',
          },
          opacity: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Watermark opacity 0-1 (default: 0.8)',
          },
          fontSize: {
            type: 'number',
            description: 'Font size for text watermark (default: 24)',
          },
          color: {
            type: 'string',
            description: 'Color for text watermark (default: #ffffff)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_watermarked.<ext>)',
          },
        },
        required: ['input_path'],
      },
      handler: (p) =>
        imageWatermark(
          p as Parameters<typeof imageWatermark>[0],
          runtime
        ),
    },
  ];
}

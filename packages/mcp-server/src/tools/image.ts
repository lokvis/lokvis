/**
 * Image tools:MCP tool handlers for image processing.
 *
 * 3 个 tool 直接使用 sharp 处理本地图片文件:
 * - lokvis_image_resize: 调整尺寸
 * - lokvis_image_compress: 压缩(jpeg/png quality)
 * - lokvis_image_convert: 格式转换
 *
 * M2.1 阶段直接使用 sharp;M2.2 后将 sharp 封装到 engine-image-node 包,
 * tool handler 改为通过 runtime capability 系统调用。
 *
 * 输入:文件路径(绝对路径或相对 workdir)
 * 输出:处理后的文件路径 + 元数据(尺寸/大小变化)
 */

import sharp from 'sharp';
import { resolve, dirname, basename, extname, join } from 'node:path';
import { stat } from 'node:fs/promises';
import type { McpToolResult } from '../server.js';

/** 生成输出路径:输入路径加后缀,如 `image.png` → `image_resized.png` */
function makeOutputPath(
  inputPath: string,
  suffix: string,
  newExt?: string
): string {
  const dir = dirname(inputPath);
  const base = basename(inputPath, extname(inputPath));
  const ext = newExt || extname(inputPath).slice(1) || 'png';
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
 * lokvis_image_resize:调整图片尺寸。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - width: 目标宽度(可选,不指定则按 height 等比缩放)
 * - height: 目标高度(可选,不指定则按 width 等比缩放)
 * - fit: 缩放策略 'cover'|'contain'|'fill'(可选,默认 'cover')
 * - output_path: 输出路径(可选,默认输入路径加 _resized 后缀)
 */
export async function imageResize(params: {
  input_path: string;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  output_path?: string;
}): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const width = params.width;
  const height = params.height;
  const fit = params.fit ?? 'cover';
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'resized');

  if (!width && !height) {
    return {
      content: [
        { type: 'text', text: 'Error: at least one of width or height must be specified' },
      ],
      isError: true,
    };
  }

  try {
    const pipeline = sharp(inputPath).resize({
      width,
      height,
      fit,
      withoutEnlargement: true,
    });
    const info = await pipeline.toFile(outputPath);
    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image resized successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(info.size)})`,
            `  Dimensions: ${info.width}x${info.height}`,
            `  Format: ${info.format}`,
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
 * 注意:对于 PNG,quality 控制压缩级别(通过 palette + quality);
 * 对于 JPEG/WebP,直接控制质量因子。
 */
export async function imageCompress(params: {
  input_path: string;
  quality?: number;
  output_path?: string;
}): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const quality = params.quality ?? 80;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'compressed');

  if (quality < 1 || quality > 100) {
    return {
      content: [
        { type: 'text', text: 'Error: quality must be between 1 and 100' },
      ],
      isError: true,
    };
  }

  try {
    const metadata = await sharp(inputPath).metadata();
    const format = metadata.format ?? 'jpeg';

    let pipeline = sharp(inputPath);
    if (format === 'jpeg' || format === 'jpg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (format === 'avif') {
      pipeline = pipeline.avif({ quality });
    } else if (format === 'png') {
      // PNG 是无损格式,使用 compressionLevel(0-9)和 palette 量化减色
      pipeline = pipeline.png({
        quality: Math.min(quality, 100),
        palette: quality < 100,
        compressionLevel: 9,
        colours: Math.round((quality / 100) * 256),
      });
    } else {
      // 未知格式,转为 jpeg 压缩
      pipeline = pipeline.jpeg({ quality });
    }

    const info = await pipeline.toFile(outputPath);
    const originalSize = await getFileSize(inputPath);
    const ratio = ((1 - info.size / originalSize) * 100).toFixed(1);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image compressed successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(info.size)})`,
            `  Quality: ${quality}%`,
            `  Saved: ${ratio}% (${formatSize(originalSize - info.size)})`,
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
export async function imageConvert(params: {
  input_path: string;
  format: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  output_path?: string;
}): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const format = params.format;
  const quality = params.quality ?? 90;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'converted', format);

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
    let pipeline = sharp(inputPath);
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (format === 'avif') {
      pipeline = pipeline.avif({ quality });
    }

    const info = await pipeline.toFile(outputPath);
    const originalSize = await getFileSize(inputPath);
    const inputMetadata = await sharp(inputPath).metadata();

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image converted successfully.`,
            `  Input: ${inputPath} (${inputMetadata.format}, ${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${info.format}, ${formatSize(info.size)})`,
            `  Dimensions: ${info.width}x${info.height}`,
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
 * 注册 image tools 到 MCP server adapter。
 *
 * Tool 命名遵循 manifest 约定:`lokvis_${capability.replace(/\./g, '_')}`
 * - image.resize → lokvis_image_resize
 * - image.compress → lokvis_image_compress
 * - image.convert → lokvis_image_convert
 */
export function getImageToolRegistrations(): Array<{
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
        imageResize(p as Parameters<typeof imageResize>[0]),
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
        imageCompress(p as Parameters<typeof imageCompress>[0]),
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
        imageConvert(p as Parameters<typeof imageConvert>[0]),
    },
  ];
}

/**
 * Image tools:MCP tool handlers for image processing.
 *
 * 10 个 tool 经 runtime capability 系统调用(TD-1.1 长期方案):
 * - lokvis_image_resize: 调整尺寸(image.resize)
 * - lokvis_image_compress: 压缩(image.compress)
 * - lokvis_image_convert: 格式转换(image.convert)
 * - lokvis_image_crop: 裁剪(image.crop)
 * - lokvis_image_watermark: 水印(image.watermark)
 * - lokvis_image_rotate: 旋转(image.rotate)
 * - lokvis_image_flip: 翻转(image.flip)
 * - lokvis_image_background: 背景填充(image.background)
 * - lokvis_image_filter: 滤镜(image.filter)
 * - lokvis_image_favicon: ICO favicon 生成(image.favicon)
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

import { resolve, extname } from 'node:path';
import type { LokvisRuntime, ImageMetadata } from '@lokvis/sdk';
import { mimeFromExt, formatFromExt } from '@lokvis/schema';
import type { ImageWatermarkPosition } from '@lokvis/capability';
import type { McpToolResult } from '../server.js';
import {
  blobToFile,
  makeOutputPath,
  getFileSize,
  formatSize,
} from './fs-helpers.js';
import { runFileTransform } from './workflow-helpers.js';
import {
  resizeSchema,
  compressSchema,
  convertSchema,
  cropSchema,
  watermarkSchema,
  rotateSchema,
  flipSchema,
  backgroundSchema,
  filterSchema,
  faviconSchema,
  validateParams,
} from './schemas.js';
import { GENERATED_TOOL_META } from './tool-metadata.generated.js';
import { requireToolMeta } from './manual-overrides.js';

/** 从文件路径扩展名推断 MIME(委托 @lokvis/schema 单一映射表,FO-14) */
function extToMime(path: string): string {
  const ext = extname(path).slice(1).toLowerCase();
  return mimeFromExt(ext);
}

/** 水印位置(从 capability manifest 派生,避免本地复制漂移) */
type WatermarkPosition = ImageWatermarkPosition;

/**
 * 通用 image transform 流程(FO-18 工厂化)。
 *
 * dimensions 读取通过 onExported 回调在 cleanup 前完成(走 MetadataReader 依赖反转)。
 */
async function runImageTransform(
  runtime: LokvisRuntime,
  inputPath: string,
  capability: string,
  params: Record<string, unknown>
): Promise<{ outBlob: Blob; outMeta: ImageMetadata | null }> {
  const result = await runFileTransform({
    runtime,
    inputPaths: [inputPath],
    capability,
    params,
    mime: extToMime(inputPath),
    category: 'image',
    assetType: 'image',
    onExported: async (outAssetId) => {
      const outMeta = await runtime.readAssetImageMetadata(outAssetId);
      return { outMeta };
    },
  });
  return { outBlob: result.outBlob, outMeta: result.outMeta as ImageMetadata | null };
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
    const format = (formatFromExt(inputExt) ?? 'webp') as
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
 * lokvis_image_rotate:旋转图片。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - angle: 旋转角度(必填,度数,支持任意角度)
 * - background: 空白区域填充色(可选,默认 '#ffffff')
 * - output_path: 输出路径(可选,默认输入路径加 _rotated 后缀)
 */
export async function imageRotate(
  params: {
    input_path: string;
    angle: number;
    background?: string;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const { angle } = params;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'rotated', 'png');

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.rotate',
      { angle, background: params.background ?? '#ffffff' }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image rotated successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Angle: ${angle}°`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to rotate image: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_flip:翻转图片。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - axis: 翻转轴 'horizontal'|'vertical'|'both'(必填)
 * - output_path: 输出路径(可选,默认输入路径加 _flipped 后缀)
 */
export async function imageFlip(
  params: {
    input_path: string;
    axis: 'horizontal' | 'vertical' | 'both';
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const { axis } = params;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'flipped', 'png');

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.flip',
      { axis }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Image flipped successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Axis: ${axis}`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to flip image: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_background:替换透明背景为指定颜色。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - color: 背景色 CSS 颜色值(必填,如 '#ffffff'、'rgb(255,0,0)')
 * - output_path: 输出路径(可选,默认输入路径加 _bg 后缀)
 */
export async function imageBackground(
  params: {
    input_path: string;
    color: string;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const { color } = params;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'bg', 'png');

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.background',
      { color }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Background applied successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Background: ${color}`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to apply background: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_filter:应用预设滤镜。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - preset: 滤镜预设 'grayscale'|'invert'|'sepia'|'blur'(必填)
 * - radius: 模糊半径(可选,仅 blur 预设生效,默认 4)
 * - output_path: 输出路径(可选,默认输入路径加 _filtered 后缀)
 */
export async function imageFilter(
  params: {
    input_path: string;
    preset: 'grayscale' | 'invert' | 'sepia' | 'blur';
    radius?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const { preset, radius } = params;
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'filtered', 'png');

  try {
    const { outBlob, outMeta } = await runImageTransform(
      runtime,
      inputPath,
      'image.filter',
      { preset, radius }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Filter applied successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Filter: ${preset}${preset === 'blur' ? ` (radius: ${radius ?? 4})` : ''}`,
            `  Dimensions: ${formatDimensions(outMeta)}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to apply filter: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_image_favicon:从图片生成多尺寸 ICO favicon。
 *
 * 参数:
 * - input_path: 输入图片路径(必填)
 * - sizes: 目标尺寸数组(可选,默认 [16, 32, 48, 256])
 * - output_path: 输出路径(可选,默认输入路径加 .ico 后缀)
 */
export async function imageFavicon(
  params: {
    input_path: string;
    sizes?: number[];
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const sizes = params.sizes ?? [16, 32, 48, 256];
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'favicon', 'ico', 'ico');

  try {
    const { outBlob } = await runImageTransform(
      runtime,
      inputPath,
      'image.favicon',
      { sizes }
    );
    await blobToFile(outBlob, outputPath);

    const originalSize = await getFileSize(inputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Favicon generated successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Sizes: ${sizes.join(', ')}px`,
            `  Format: ICO (PNG-in-ICO)`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to generate favicon: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * 注册 image tools 到 MCP server adapter。
 *
 * 工具描述与 inputSchema 由 codegen 数据驱动（G4）：
 * - description / capability 映射来自 tool-metadata.generated.ts
 *   （capability manifests + @lokvis/data-formats 格式约束）
 * - inputSchema 与描述增强来自 manual-overrides.ts（MCP 特有 input_path/output_path）
 * 本函数仅提供 handler（走 runtime capability 系统）。
 *
 * @param runtime Lokvis Runtime(已安装 imageToolsPluginNode,注册 image capabilities)
 */
export function getImageToolRegistrations(runtime: LokvisRuntime): Array<{
  name: string;
  description: string;
  inputSchema: object;
  handler: (params: Record<string, unknown>) => Promise<McpToolResult>;
}> {
  const reg = (
    toolName: string,
    handler: (params: Record<string, unknown>) => Promise<McpToolResult>,
  ) => {
    const meta = requireToolMeta(GENERATED_TOOL_META, toolName);
    return {
      name: meta.name,
      description: meta.description,
      inputSchema: meta.inputSchema,
      handler,
    };
  };

  return [
    reg('lokvis_image_resize', async (p) => {
      const r = validateParams(resizeSchema, p);
      if (!r.success) return r.error;
      return imageResize(r.data, runtime);
    }),
    reg('lokvis_image_compress', async (p) => {
      const r = validateParams(compressSchema, p);
      if (!r.success) return r.error;
      return imageCompress(r.data, runtime);
    }),
    reg('lokvis_image_convert', async (p) => {
      const r = validateParams(convertSchema, p);
      if (!r.success) return r.error;
      return imageConvert(r.data, runtime);
    }),
    reg('lokvis_image_crop', async (p) => {
      const r = validateParams(cropSchema, p);
      if (!r.success) return r.error;
      return imageCrop(r.data, runtime);
    }),
    reg('lokvis_image_watermark', async (p) => {
      const r = validateParams(watermarkSchema, p);
      if (!r.success) return r.error;
      return imageWatermark(r.data, runtime);
    }),
    reg('lokvis_image_rotate', async (p) => {
      const r = validateParams(rotateSchema, p);
      if (!r.success) return r.error;
      return imageRotate(r.data, runtime);
    }),
    reg('lokvis_image_flip', async (p) => {
      const r = validateParams(flipSchema, p);
      if (!r.success) return r.error;
      return imageFlip(r.data, runtime);
    }),
    reg('lokvis_image_background', async (p) => {
      const r = validateParams(backgroundSchema, p);
      if (!r.success) return r.error;
      return imageBackground(r.data, runtime);
    }),
    reg('lokvis_image_filter', async (p) => {
      const r = validateParams(filterSchema, p);
      if (!r.success) return r.error;
      return imageFilter(r.data, runtime);
    }),
    reg('lokvis_image_favicon', async (p) => {
      const r = validateParams(faviconSchema, p);
      if (!r.success) return r.error;
      return imageFavicon(r.data, runtime);
    }),
  ];
}

/**
 * 水印操作:文字水印 / 图片水印
 *
 * 基于 sharp 的 composite + SVG overlay 实现:
 * - 文字水印:生成 SVG <text> 元素,composite 到源图
 * - 图片水印:fetch / data URL → Buffer,composite 到源图
 *
 * 与浏览器版 operations/watermark.ts 对齐:
 * - 位置 9 宫格 + tile 模式
 * - opacity 透明度
 * - SSRF 校验(同 engine-image)
 *
 * 注:sharp 无原生 canvas 文字渲染,用 SVG 是最稳定的 Node 端方案,
 * libvips 内置 librsvg 渲染 SVG。
 *
 * 类型复用自 ../../types.js(问题 B:消除 engine-image-node 双源维护)。
 */
import type { WatermarkParams, WatermarkPosition } from '../../types.js';
import {
  bufferToBlobPart,
  inferFormat,
  isSafeImageUrl,
  throwIfAborted,
  toSharpFormat,
} from './utils.js';

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function sharpToBlob(
  pipeline: import('sharp').Sharp,
  format: string,
  quality: number
): Promise<Blob> {
  const buffer = await pipeline
    .toFormat(format as keyof import('sharp').FormatEnum, { quality })
    .toBuffer();
  return new Blob([bufferToBlobPart(buffer)], {
    type: `image/${format === 'jpeg' ? 'jpeg' : format}`,
  });
}

/** 计算水印位置(与浏览器版 computeWatermarkPosition 一致,margin=16) */
function computeWatermarkPosition(
  position: NonNullable<WatermarkPosition>,
  canvasW: number,
  canvasH: number,
  wmW: number,
  wmH: number
): { x: number; y: number } {
  const margin = 16;
  switch (position) {
    case 'top-left':
      return { x: margin, y: margin };
    case 'top-right':
      return { x: canvasW - wmW - margin, y: margin };
    case 'bottom-left':
      return { x: margin, y: canvasH - wmH - margin };
    case 'bottom-right':
      return { x: canvasW - wmW - margin, y: canvasH - wmH - margin };
    case 'center':
      return { x: Math.round((canvasW - wmW) / 2), y: Math.round((canvasH - wmH) / 2) };
    default:
      return { x: margin, y: margin };
  }
}

/** 生成文字水印 SVG Buffer(支持 tile / 单位置) */
function buildTextWatermarkSvg(
  text: string,
  fontSize: number,
  color: string,
  opacity: number,
  canvasW: number,
  canvasH: number,
  position: NonNullable<WatermarkPosition>
): Buffer {
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const safeText = escapeXml(text);
  const safeColor = escapeXml(color);

  // 测量文字宽度(粗略估算:fontSize * 0.6 * charCount,实际 SVG 渲染时由 librsvg 精确测量)
  // tile 模式按此估算 spacing,与浏览器版 measureText 有差异,但视觉接近
  const estimatedTextW = text.length * fontSize * 0.6;
  const spacing = Math.max(estimatedTextW, fontSize) * 1.5;

  if (position === 'tile') {
    const cells: string[] = [];
    for (let y = 0; y < canvasH + fontSize; y += fontSize + spacing) {
      for (let x = 0; x < canvasW + estimatedTextW; x += estimatedTextW + spacing) {
        cells.push(
          `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${fontSize}" fill="${safeColor}" font-family="sans-serif">${safeText}</text>`
        );
      }
    }
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" opacity="${opacity}">${cells.join('')}</svg>`
    );
  }

  const pos = computeWatermarkPosition(
    position,
    canvasW,
    canvasH,
    estimatedTextW,
    fontSize
  );
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" opacity="${opacity}">` +
      `<text x="${pos.x.toFixed(2)}" y="${(pos.y + fontSize).toFixed(2)}" font-size="${fontSize}" fill="${safeColor}" font-family="sans-serif">${safeText}</text>` +
      `</svg>`
  );
}

/**
 * Watermark:水印。
 *
 * 与浏览器版 watermark 对齐:
 * - text / image 二选一(image 优先,无 text 也无 image 时返回原图)
 * - position 支持 9 宫格 + tile
 * - opacity 默认 0.8
 * - fontSize 默认 24,color 默认 #ffffff
 * - image URL 走 SSRF 校验
 */
export async function watermark(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const {
    text,
    image: imageUrl,
    position,
    opacity,
    fontSize,
    color,
  } = params as WatermarkParams;

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);
  const meta = await sharp(srcBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error('watermark: invalid image dimensions');
  }

  const wmOpacity = opacity ?? 0.8;
  const wmFontSize = fontSize ?? 24;
  const wmColor = color ?? '#ffffff';
  const wmPosition: NonNullable<WatermarkPosition> = position ?? 'bottom-right';

  // 无 text 也无 image:返回原图(与浏览器版行为一致)
  if (!imageUrl && !text) {
    const format = inferFormat(blob, 'png');
    return sharpToBlob(sharp(srcBuffer), toSharpFormat(format), 95);
  }

  const blend: import('sharp').OverlayOptions['blend'] = 'over';

  if (imageUrl) {
    if (!isSafeImageUrl(imageUrl)) {
      throw new Error(
        `Watermark image URL not allowed (SSRF guard): ${imageUrl}`
      );
    }
    const resp = await fetch(imageUrl, signal ? { signal } : undefined);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch watermark image from ${imageUrl}: ${resp.status} ${resp.statusText}`
      );
    }
    const wmBlob = await resp.blob();
    const overlayBuffer = await blobToBuffer(wmBlob);

    if (wmPosition === 'tile') {
      // tile 模式:简化为单位置 composite(tile 完整实现留待后续)
      const wmMeta = await sharp(overlayBuffer).metadata();
      const pos = computeWatermarkPosition(
        wmPosition,
        width,
        height,
        wmMeta.width ?? 0,
        wmMeta.height ?? 0
      );
      const pipeline = sharp(srcBuffer).composite([
        { input: overlayBuffer, left: pos.x, top: pos.y, blend },
      ]);
      throwIfAborted(signal);
      const format = inferFormat(blob, 'png');
      return sharpToBlob(pipeline, toSharpFormat(format), 95);
    }

    // 单位置:用 composite,需先计算 wm 尺寸
    const wmMeta = await sharp(overlayBuffer).metadata();
    const pos = computeWatermarkPosition(
      wmPosition,
      width,
      height,
      wmMeta.width ?? 0,
      wmMeta.height ?? 0
    );
    const pipeline = sharp(srcBuffer).composite([
      { input: overlayBuffer, left: pos.x, top: pos.y, blend },
    ]);
    throwIfAborted(signal);
    const format = inferFormat(blob, 'png');
    return sharpToBlob(pipeline, toSharpFormat(format), 95);
  }

  // text 水印:生成 SVG overlay
  const overlayBuffer = buildTextWatermarkSvg(
    text!,
    wmFontSize,
    wmColor,
    wmOpacity,
    width,
    height,
    wmPosition
  );

  const pipeline = sharp(srcBuffer).composite([
    { input: overlayBuffer, top: 0, left: 0, blend },
  ]);
  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return sharpToBlob(pipeline, toSharpFormat(format), 95);
}

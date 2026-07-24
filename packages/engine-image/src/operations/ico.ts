/**
 * ICO (favicon) 编码操作
 *
 * ICO 是多尺寸容器格式:一个文件内嵌 N 个正方形 PNG 条目
 * (16/32/48/256 等),供浏览器 <link rel="icon"> 与操作系统按需选取。
 * 语义上区别于 image.convert(1→1 同尺寸换编码),故独立为 image.favicon。
 *
 * 实现:decode → 对每个目标尺寸 cover 居中裁切 → 编码 PNG →
 * 二进制打包为 ICONDIR + ICONDIRENTRY[] + PNG data(Vista+ PNG-in-ICO 规范)。
 * 内嵌完整 PNG 文件(非旧版 BMP DIB),所有条目 bitCount=32(RGBA)。
 *
 * 对外仍是纯 Blob → Blob(遵循 Engine 层约束),最终容器打包不经
 * canvasEngine.encode(其 MIME_BY_FORMAT 不含 ico),而是手写字节。
 */
import type { EncodeIcoParams } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { throwIfAborted } from './utils.js';

/** ICO 默认尺寸集(经典标签页 + 高分屏 + 最大兼容) */
const DEFAULT_ICO_SIZES = [16, 32, 48, 256];

/**
 * 规范化尺寸列表:去重、clamp 到 1-256、升序排列。
 * 空或全非法时回退到默认集。
 */
function normalizeSizes(sizes?: number[]): number[] {
  const source = Array.isArray(sizes) && sizes.length > 0 ? sizes : DEFAULT_ICO_SIZES;
  const cleaned = source
    .map((s) => Math.round(s))
    .filter((s) => Number.isFinite(s) && s >= 1)
    .map((s) => Math.min(256, s));
  const unique = Array.from(new Set(cleaned)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_ICO_SIZES];
}

/**
 * 将多个 PNG 条目打包为 ICO 二进制(纯计算,无 DOM/canvas 依赖)。
 * ICONDIR(6B) + N×ICONDIRENTRY(16B) + N×PNG data。
 */
function packIco(sizes: number[], pngBuffers: ArrayBuffer[]): ArrayBuffer {
  const count = sizes.length;
  const headerSize = 6 + count * 16;

  let offset = headerSize;
  const entries = sizes.map((size, i) => {
    const byteLength = pngBuffers[i]!.byteLength;
    const entry = { size, byteLength, offset };
    offset += byteLength;
    return entry;
  });

  const total = offset;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = 1 (ICO)
  view.setUint16(4, count, true); // count

  // ICONDIRENTRY[]
  entries.forEach((e, i) => {
    const base = 6 + i * 16;
    // width/height 为 u8,256 用 0 表示
    view.setUint8(base, e.size >= 256 ? 0 : e.size);
    view.setUint8(base + 1, e.size >= 256 ? 0 : e.size);
    view.setUint8(base + 2, 0); // colorCount (≥8bpp → 0)
    view.setUint8(base + 3, 0); // reserved
    view.setUint16(base + 4, 1, true); // planes
    view.setUint16(base + 6, 32, true); // bitCount (RGBA)
    view.setUint32(base + 8, e.byteLength, true); // bytesInRes
    view.setUint32(base + 12, e.offset, true); // imageOffset
  });

  // PNG data
  let pos = headerSize;
  for (const buf of pngBuffers) {
    new Uint8Array(buffer, pos, buf.byteLength).set(new Uint8Array(buf));
    pos += buf.byteLength;
  }

  return buffer;
}

/**
 * EncodeIco:从任意图片生成多尺寸 ICO favicon。
 *
 * 非正方形输入按 cover 策略居中裁切为正方形后缩放到各目标尺寸。
 */
export async function encodeIco(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const { sizes: rawSizes } = params as EncodeIcoParams;
  const sizes = normalizeSizes(rawSizes);

  const { bitmap, width: srcW, height: srcH } = await canvasEngine.decode(blob);
  try {
    // cover 居中裁切:取短边为正方形源区域
    const srcSize = Math.min(srcW, srcH);
    const sx = Math.round((srcW - srcSize) / 2);
    const sy = Math.round((srcH - srcSize) / 2);

    const pngBuffers: ArrayBuffer[] = [];
    for (const size of sizes) {
      throwIfAborted(signal);
      const canvas = createCanvas(size, size);
      const ctx = get2DContext(canvas);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, size, size);
      const pngBlob = await canvasEngine.encode(canvas, 'png');
      pngBuffers.push(await pngBlob.arrayBuffer());
    }

    throwIfAborted(signal);
    const icoBuffer = packIco(sizes, pngBuffers);
    return new Blob([icoBuffer], { type: 'image/x-icon' });
  } finally {
    bitmap.close?.();
  }
}

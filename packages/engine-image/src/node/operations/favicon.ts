/**
 * ICO favicon 编码操作(Node 引擎)
 *
 * 与浏览器版 operations/ico.ts 对齐:
 * - 输入任意图片,输出多尺寸 ICO 容器
 * - 非正方形输入按 cover 策略居中裁切为正方形
 * - 每个尺寸用 sharp resize 生成 PNG,再打包为 ICO 二进制
 *
 * ICO 格式:ICONDIR(6B) + N×ICONDIRENTRY(16B) + N×PNG data
 * 内嵌完整 PNG 文件(Vista+ PNG-in-ICO 规范),bitCount=32(RGBA)。
 *
 * 与浏览器版的区别:
 * - 浏览器版用 canvas drawImage 缩放 + canvasEngine.encode('png')
 * - Node 版用 sharp resize + .png() 输出
 * - ICO 打包逻辑(packIco)完全相同(纯字节操作,无环境依赖)
 */
import type { EncodeIcoParams } from '../../types.js';
import { bufferToBlobPart, throwIfAborted } from './utils.js';

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
 *
 * 与浏览器版 operations/ico.ts 的 packIco 完全一致。
 */
function packIco(sizes: number[], pngBuffers: Buffer[]): Buffer {
  const count = sizes.length;
  const headerSize = 6 + count * 16;

  let offset = headerSize;
  const entries = sizes.map((size, i) => {
    const byteLength = pngBuffers[i]!.length;
    const entry = { size, byteLength, offset };
    offset += byteLength;
    return entry;
  });

  const total = offset;
  const buffer = Buffer.alloc(total);

  // ICONDIR
  buffer.writeUInt16LE(0, 0); // reserved
  buffer.writeUInt16LE(1, 2); // type = 1 (ICO)
  buffer.writeUInt16LE(count, 4); // count

  // ICONDIRENTRY[]
  entries.forEach((e, i) => {
    const base = 6 + i * 16;
    // width/height 为 u8,256 用 0 表示
    buffer.writeUInt8(e.size >= 256 ? 0 : e.size, base);
    buffer.writeUInt8(e.size >= 256 ? 0 : e.size, base + 1);
    buffer.writeUInt8(0, base + 2); // colorCount (≥8bpp → 0)
    buffer.writeUInt8(0, base + 3); // reserved
    buffer.writeUInt16LE(1, base + 4); // planes
    buffer.writeUInt16LE(32, base + 6); // bitCount (RGBA)
    buffer.writeUInt32LE(e.byteLength, base + 8); // bytesInRes
    buffer.writeUInt32LE(e.offset, base + 12); // imageOffset
  });

  // PNG data
  let pos = headerSize;
  for (const buf of pngBuffers) {
    buf.copy(buffer, pos);
    pos += buf.length;
  }

  return buffer;
}

/**
 * EncodeIco:从任意图片生成多尺寸 ICO favicon。
 *
 * 非正方形输入按 cover 策略居中裁切为正方形后缩放到各目标尺寸。
 * 与浏览器版 encodeIco 行为完全一致。
 */
export async function encodeIco(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { sizes: rawSizes } = params as EncodeIcoParams;
  const sizes = normalizeSizes(rawSizes);

  const arrayBuffer = await blob.arrayBuffer();
  const srcBuffer = Buffer.from(arrayBuffer);
  throwIfAborted(signal);

  // 获取源图尺寸,计算 cover 居中裁切区域
  const meta = await sharp(srcBuffer).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW === 0 || srcH === 0) {
    throw new Error('encodeIco: invalid image dimensions');
  }

  // cover 居中裁切:取短边为正方形源区域
  const srcSize = Math.min(srcW, srcH);
  const sx = Math.round((srcW - srcSize) / 2);
  const sy = Math.round((srcH - srcSize) / 2);

  const pngBuffers: Buffer[] = [];
  for (const size of sizes) {
    throwIfAborted(signal);
    // 先 extract 正方形区域,再 resize 到目标尺寸
    const pngBuffer = await sharp(srcBuffer, { failOn: 'none' })
      .extract({ left: sx, top: sy, width: srcSize, height: srcSize })
      .resize(size, size, { fit: 'fill' })
      .png()
      .toBuffer();
    pngBuffers.push(pngBuffer);
  }

  throwIfAborted(signal);
  const icoBuffer = packIco(sizes, pngBuffers);
  return new Blob([bufferToBlobPart(icoBuffer)], { type: 'image/x-icon' });
}

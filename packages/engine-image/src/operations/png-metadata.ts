/**
 * PNG 元数据嵌入:DPI(物理分辨率)写入 pHYs chunk(W8.4 长期方案)。
 *
 * 背景:canvas `toBlob` / `convertToBlob` 生成的 PNG 不携带物理分辨率信息,
 * 打印软件无法读取 DPI。pHYs 是 PNG 标准的"物理像素尺寸"chunk(ISO/IEC 15948),
 * 记录"每米像素数"(pixels per meter),打印软件据此换算 DPI。
 *
 * 本模块提供 Blob→Blob 纯函数,符合 Engine 层"不感知 Asset/Workflow"的约束。
 * 仅支持 PNG(JPEG/BMP 等格式的 DPI 嵌入规范各异,且 W8.4 打印类预设推荐 PNG)。
 *
 * pHYs chunk 结构(共 9 字节数据 + 4 字节类型 + 4 字节长度 + 4 字节 CRC):
 *   - 类型 "pHYs"
 *   - pixels per unit, X axis: 4 字节 unsigned int(大端)
 *   - pixels per unit, Y axis: 4 字节 unsigned int(大端)
 *   - unit specifier: 1 字节(0 = 未知/仅宽高比;1 = 米)
 *   - CRC32 覆盖"类型 + 数据"9 字节
 *
 * chunk 顺序约定:pHYs 必须在 IDAT 之前,推荐紧跟 IHDR。
 */

/** PNG 文件签名(8 字节) */
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC32 表(IEEE 802.3 多项式,PNG/JPEG 通用) */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** 读取大端 unsigned int32 */
function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! * 0x1000000 +
      (bytes[offset + 1]! << 16) +
      (bytes[offset + 2]! << 8) +
      bytes[offset + 3]!) >>>
    0
  );
}

/** 写入大端 unsigned int32 */
function writeUint32BE(value: number, bytes: Uint8Array, offset: number): void {
  const v = value >>> 0;
  bytes[offset] = (v >>> 24) & 0xff;
  bytes[offset + 1] = (v >>> 16) & 0xff;
  bytes[offset + 2] = (v >>> 8) & 0xff;
  bytes[offset + 3] = v & 0xff;
}

/** DPI → 每米像素数(1 英寸 = 25.4 毫米) */
function dpiToPixelsPerMeter(dpi: number): number {
  return Math.round((dpi * 1000) / 25.4);
}

/** 每米像素数 → DPI */
function pixelsPerMeterToDpi(ppm: number): number {
  return (ppm * 25.4) / 1000;
}

/** 构造 pHYs chunk(长度+类型+数据+CRC,共 21 字节) */
function buildPhysChunk(pixelsPerMeterX: number, pixelsPerMeterY: number): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + 9 + 4); // length + type + data + crc
  writeUint32BE(9, chunk, 0); // data length
  chunk[4] = 0x70; // 'p'
  chunk[5] = 0x48; // 'H'
  chunk[6] = 0x59; // 'Y'
  chunk[7] = 0x73; // 's'
  writeUint32BE(pixelsPerMeterX, chunk, 8);
  writeUint32BE(pixelsPerMeterY, chunk, 12);
  chunk[16] = 1; // unit = 米
  const crc = crc32(chunk.subarray(4, 17)); // 覆盖 type + data
  writeUint32BE(crc, chunk, 17);
  return chunk;
}

/**
 * 把 DPI 嵌入 PNG Blob 的 pHYs chunk。
 *
 * 行为:
 * - 若 Blob 不是 PNG,原样返回(不抛错;调用方负责按格式调用)。
 * - 若已存在 pHYs chunk,替换其数据;否则在 IHDR 之后插入新的 pHYs chunk。
 * - dpi 必须为正数,否则原样返回。
 *
 * @param png PNG 格式的 Blob
 * @param dpi 物理分辨率(每英寸像素数),正数
 * @returns 新的 PNG Blob(携带 pHYs chunk)
 */
export async function embedPngDpi(png: Blob, dpi: number): Promise<Blob> {
  if (!Number.isFinite(dpi) || dpi <= 0) return png;
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (!isPng(bytes)) return png;

  const ppm = dpiToPixelsPerMeter(dpi);
  const phys = buildPhysChunk(ppm, ppm);
  const { insertOffset, existingRange } = locatePhysInsertionPoint(bytes);

  if (existingRange) {
    // 替换已有 pHYs:用新 chunk 覆盖 [start, end)
    const start = existingRange.start;
    const end = existingRange.end;
    const out = new Uint8Array(bytes.length - (end - start) + phys.length);
    out.set(bytes.subarray(0, start), 0);
    out.set(phys, start);
    out.set(bytes.subarray(end), start + phys.length);
    return new Blob([out], { type: 'image/png' });
  }

  // 插入新 pHYs 到 IHDR 之后
  const out = new Uint8Array(bytes.length + phys.length);
  out.set(bytes.subarray(0, insertOffset), 0);
  out.set(phys, insertOffset);
  out.set(bytes.subarray(insertOffset), insertOffset + phys.length);
  return new Blob([out], { type: 'image/png' });
}

/** 读取 PNG pHYs chunk 中的 DPI;无 pHYs 或非 PNG 返回 null */
export async function readPngDpi(png: Blob): Promise<number | null> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (!isPng(bytes)) return null;
  const { existingRange } = locatePhysInsertionPoint(bytes);
  if (!existingRange) return null;
  // pHYs data 在 [chunkStart+8, chunkStart+17)
  const dataStart = existingRange.start + 8; // 跳过 length(4) + type(4)
  const ppmX = readUint32BE(bytes, dataStart);
  const ppmY = readUint32BE(bytes, dataStart + 4);
  const unit = bytes[dataStart + 8]!;
  if (unit !== 1) return null; // unit != 米,无法换算 DPI
  if (ppmX !== ppmY) return null; // X/Y 不等,非常规 DPI
  return pixelsPerMeterToDpi(ppmX);
}

/** 是否为 PNG(检查 8 字节签名) */
function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

interface ChunkLocation {
  /** pHYs 应插入的偏移(IHDR 之后)。若已存在 pHYs,此值仍为 IHDR 之后 */
  insertOffset: number;
  /** 已存在 pHYs chunk 的完整字节范围(length+type+data+crc);不存在为 null */
  existingRange: { start: number; end: number } | null;
}

/**
 * 扫描 PNG chunks,定位 pHYs 的插入点 / 已存在范围。
 *
 * PNG 结构:8 字节签名 + N 个 chunk(每个:4 字节 length + 4 字节 type + length 字节 data + 4 字节 CRC)。
 * IHDR 永远是第一个 chunk,长度固定 13。pHYs 必须在 IDAT 之前。
 *
 * 返回:
 * - insertOffset:IHDR chunk 结束位置(pHYs 推荐插入点)
 * - existingRange:若途中遇到 pHYs,返回其完整字节范围;扫描到 IDAT 时停止
 */
function locatePhysInsertionPoint(bytes: Uint8Array): ChunkLocation {
  // 跳过 8 字节签名
  let offset = 8;
  // IHDR: length(4) + type(4) + data(13) + crc(4) = 25
  const ihdrEnd = offset + 25;
  let existingRange: { start: number; end: number } | null = null;

  while (offset + 8 <= bytes.length) {
    const dataLen = readUint32BE(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!
    );
    const chunkTotal = 4 + 4 + dataLen + 4; // length + type + data + crc
    const chunkEnd = offset + chunkTotal;

    if (type === 'pHYs') {
      existingRange = { start: offset, end: chunkEnd };
      // 继续扫描确保没有第二个 pHYs(异常情况);遇到 IDAT 停止
    }
    if (type === 'IDAT') {
      break; // pHYs 必须在 IDAT 之前,继续扫描无意义
    }

    // 防御:损坏的 chunk 长度避免死循环
    if (chunkTotal <= 0 || chunkEnd > bytes.length) break;
    offset = chunkEnd;
  }

  return { insertOffset: ihdrEnd, existingRange };
}

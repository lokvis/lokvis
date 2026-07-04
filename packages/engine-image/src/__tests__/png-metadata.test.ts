/**
 * PNG 物理分辨率(DPI)嵌入 / 读取单元测试(W8.4 长期方案)
 *
 * 不依赖真实 Canvas:在测试内用 node:zlib 构造最小合法 PNG,直接验证
 * embedPngDpi / readPngDpi 对 chunk 结构的读写正确性:
 * - 嵌入后 readPngDpi 能读回相同 DPI
 * - pHYs 位置在 IHDR 之后、IDAT 之前
 * - 已存在 pHYs 时替换而非重复
 * - 非 PNG / dpi 非正 → 原样返回
 * - PNG 签名与 IHDR 完整性不变
 */
import { describe, it, expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import { embedPngDpi, readPngDpi } from '../operations/png-metadata.js';

// ─── CRC32(PNG/JPEG IEEE 多项式)─────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u32be(value: number): [number, number, number, number] {
  const v = value >>> 0;
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}

/** 构造一个 PNG chunk: length + type + data + crc */
function chunk(type: string, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  const typeBytes = Uint8Array.from(type, (ch) => ch.charCodeAt(0));
  const out = new Uint8Array(4 + 4 + data.length + 4);
  out.set(u32be(data.length), 0);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  out.set(u32be(crc32(crcInput)), 8 + data.length);
  return out;
}

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 构造最小合法 PNG(1×1 RGBA)。可选在 IHDR 后插入额外 chunk 测试定位。 */
function buildMinimalPng(extraChunkAfterIhdr?: Uint8Array): Uint8Array {
  // IHDR data: width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1)
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(1), 0); // width=1
  ihdr.set(u32be(1), 4); // height=1
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type = RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: scanline = [filter=0, R, G, B, A]
  const scanline = new Uint8Array([0, 0xff, 0x00, 0x00, 0xff]);
  const idat = deflateSync(scanline);

  const parts: Uint8Array[] = [PNG_SIG, chunk('IHDR', ihdr)];
  if (extraChunkAfterIhdr) parts.push(extraChunkAfterIhdr);
  parts.push(chunk('IDAT', idat));
  parts.push(chunk('IEND'));

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** 在 bytes 中查找指定 chunk 类型的起始偏移(扫描到 IDAT 为止) */
function findChunk(bytes: Uint8Array, type: string): number {
  let off = 8; // 跳过签名
  while (off + 8 <= bytes.length) {
    const t = String.fromCharCode(
      bytes[off + 4]!,
      bytes[off + 5]!,
      bytes[off + 6]!,
      bytes[off + 7]!
    );
    if (t === type) return off;
    const dataLen = (bytes[off]! << 24) | (bytes[off + 1]! << 16) | (bytes[off + 2]! << 8) | bytes[off + 3]!;
    off += 4 + 4 + dataLen + 4;
    if (t === 'IDAT') break;
  }
  return -1;
}

function blobOf(bytes: Uint8Array): Blob {
  // 拷贝到新 ArrayBuffer,确保 BlobPart 接受(TS 5.7+ 要求 ArrayBufferView<ArrayBuffer>)
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: 'image/png' });
}

// ─── 嵌入与读回 ───────────────────────────────────────────────

describe('embedPngDpi / readPngDpi', () => {
  it('嵌入 300 DPI 后 readPngDpi 应读回 ~300', async () => {
    const png = blobOf(buildMinimalPng());
    const embedded = await embedPngDpi(png, 300);
    const dpi = await readPngDpi(embedded);
    expect(dpi).not.toBeNull();
    expect(dpi!).toBeCloseTo(300, 1);
  });

  it('嵌入 72 DPI 后应读回 ~72', async () => {
    const png = blobOf(buildMinimalPng());
    const embedded = await embedPngDpi(png, 72);
    const dpi = await readPngDpi(embedded);
    expect(dpi).not.toBeNull();
    expect(dpi!).toBeCloseTo(72, 1);
  });

  it('原始 PNG(无 pHYs)readPngDpi 应返回 null', async () => {
    const png = blobOf(buildMinimalPng());
    const dpi = await readPngDpi(png);
    expect(dpi).toBeNull();
  });

  it('pHYs 应位于 IHDR 之后、IDAT 之前', async () => {
    const png = blobOf(buildMinimalPng());
    const embedded = new Uint8Array(await (await embedPngDpi(png, 300)).arrayBuffer());
    const ihdrOff = findChunk(embedded, 'IHDR');
    const physOff = findChunk(embedded, 'pHYs');
    const idatOff = findChunk(embedded, 'IDAT');
    expect(physOff).toBeGreaterThan(ihdrOff);
    expect(physOff).toBeLessThan(idatOff);
  });

  it('PNG 签名与 IHDR 应保持完整(嵌入不破坏文件头)', async () => {
    const original = buildMinimalPng();
    const embedded = new Uint8Array(await (await embedPngDpi(blobOf(original), 300)).arrayBuffer());
    // 签名
    for (let i = 0; i < 8; i++) expect(embedded[i]).toBe(original[i]);
    // IHDR chunk(length + type + data + crc)原样保留
    for (let i = 8; i < 8 + 25; i++) expect(embedded[i]).toBe(original[i]);
  });

  it('已存在 pHYs 时应替换而非重复插入', async () => {
    const png = blobOf(buildMinimalPng());
    const once = await embedPngDpi(png, 300);
    const twice = await embedPngDpi(once, 150);
    const bytes = new Uint8Array(await twice.arrayBuffer());
    // 统计 pHYs 出现次数:应只有 1 个
    let count = 0;
    let off = 8;
    while (off + 8 <= bytes.length) {
      const t = String.fromCharCode(bytes[off + 4]!, bytes[off + 5]!, bytes[off + 6]!, bytes[off + 7]!);
      if (t === 'pHYs') count++;
      const dataLen = (bytes[off]! << 24) | (bytes[off + 1]! << 16) | (bytes[off + 2]! << 8) | bytes[off + 3]!;
      off += 4 + 4 + dataLen + 4;
      if (t === 'IDAT') break;
    }
    expect(count).toBe(1);
    // 读回应是最新值 150
    const dpi = await readPngDpi(twice);
    expect(dpi!).toBeCloseTo(150, 1);
  });

  it('dpi 非正数应原样返回(不嵌入)', async () => {
    const original = buildMinimalPng();
    const out0 = await embedPngDpi(blobOf(original), 0);
    const outNeg = await embedPngDpi(blobOf(original), -10);
    expect(new Uint8Array(await out0.arrayBuffer())).toEqual(original);
    expect(new Uint8Array(await outNeg.arrayBuffer())).toEqual(original);
  });

  it('dpi 非有限值(NaN/Infinity)应原样返回', async () => {
    const original = buildMinimalPng();
    const outNan = await embedPngDpi(blobOf(original), Number.NaN);
    const outInf = await embedPngDpi(blobOf(original), Number.POSITIVE_INFINITY);
    expect(new Uint8Array(await outNan.arrayBuffer())).toEqual(original);
    expect(new Uint8Array(await outInf.arrayBuffer())).toEqual(original);
  });

  it('非 PNG Blob 应原样返回(不抛错)', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])], { type: 'image/jpeg' });
    const out = await embedPngDpi(jpeg, 300);
    expect(out).toBe(jpeg);
    expect(await readPngDpi(jpeg)).toBeNull();
  });

  it('嵌入后 Blob type 应为 image/png', async () => {
    const png = blobOf(buildMinimalPng());
    const embedded = await embedPngDpi(png, 300);
    expect(embedded.type).toBe('image/png');
  });

  it('pHYs 在已存在其它 ancillary chunk 时仍应插入到 IHDR 之后', async () => {
    // 在 IHDR 后插入一个 tEXt chunk,验证 pHYs 仍能正确插入到 IHDR 之后、IDAT 之前
    const textData = new Uint8Array([...Uint8Array.from('Comment', (c) => c.charCodeAt(0)), 0, ...Uint8Array.from('hello', (c) => c.charCodeAt(0))]);
    const png = blobOf(buildMinimalPng(chunk('tEXt', textData)));
    const embedded = new Uint8Array(await (await embedPngDpi(png, 300)).arrayBuffer());
    const ihdrOff = findChunk(embedded, 'IHDR');
    const physOff = findChunk(embedded, 'pHYs');
    const idatOff = findChunk(embedded, 'IDAT');
    expect(physOff).toBeGreaterThan(ihdrOff);
    expect(physOff).toBeLessThan(idatOff);
    const dpi = await readPngDpi(new Blob([embedded], { type: 'image/png' }));
    expect(dpi!).toBeCloseTo(300, 1);
  });
});

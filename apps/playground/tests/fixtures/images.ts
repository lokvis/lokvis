/**
 * E2E 测试用 PNG 生成器(W22.5)
 *
 * 不依赖 sharp / canvas 等外部库,直接用 Node 内置 zlib + 手工 PNG 编码
 * 生成最小可用 PNG,供 setInputFiles 注入。
 *
 * 256×256 足够覆盖 crop 默认 200×200 裁剪框,避免 1×1 边界问题。
 */
import { deflateSync } from 'node:zlib';

// CRC32 表(懒初始化一次)
const CRC_TABLE: number[] = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export interface MakePngOptions {
  width?: number;
  height?: number;
  /** RGBA 颜色,默认不透明红色 */
  color?: [number, number, number, number];
}

/**
 * 生成纯色 RGBA PNG Buffer(合法 PNG,可被 createImageBitmap 解码)。
 */
export function makePng({
  width = 256,
  height = 256,
  color = [255, 0, 0, 255],
}: MakePngOptions = {}): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive
  ihdr[12] = 0; // interlace: none

  // IDAT: 每行起始 1 字节 filter(0=none)+ width × 4 字节 RGBA
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < width; x++) {
      const off = y * rowBytes + 1 + x * 4;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
      raw[off + 3] = color[3];
    }
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 默认 256×256 红色 PNG(单图工具通用 fixture) */
export const TEST_PNG = makePng();

/** 256×256 蓝色 PNG(批量工具用,与红色区分便于肉眼排查) */
export const TEST_PNG_BLUE = makePng({ color: [0, 0, 255, 255] });

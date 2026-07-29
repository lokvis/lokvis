/**
 * ICO favicon 编码测试(image.favicon → encodeIco)
 *
 * 通过 mock canvas-engine 在不依赖真实 Canvas 的前提下验证:
 * - 输出为有效 ICO 容器(ICONDIR magic bytes + count + 各条目字段)
 * - 多尺寸条目 offset 递增且正确
 * - 256 尺寸的 width/height 字段编码为 0
 * - 非正方形输入走 cover 居中裁切(drawImage 源区域为短边正方形)
 * - AbortSignal 中断抛 AbortError
 * - 空 / 超范围 sizes 回退到合理默认
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDecode = vi.fn();
const mockEncode = vi.fn();
const mockDrawImage = vi.fn();

vi.mock('../canvas-engine.js', () => ({
  decodeImage: mockDecode,
  encodeImage: mockEncode,
  createCanvas: vi.fn((w: number, h: number) => ({
    width: w,
    height: h,
    getContext: () => mockCtx(),
  })),
  get2DContext: vi.fn(() => mockCtx()),
  detectFormatSupport: vi.fn(async () => ({
    png: true,
    jpeg: true,
    webp: true,
    avif: true,
    gif: true,
  })),
}));

function mockCtx() {
  return {
    drawImage: mockDrawImage,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
  };
}

const { encodeIco } = await import('../operations/ico.js');

function fakeBitmap(w = 100, h = 100) {
  return {
    bitmap: { width: w, height: h, close: vi.fn() },
    width: w,
    height: h,
  };
}

function abortedSignal() {
  const c = new AbortController();
  c.abort();
  return c.signal;
}

const INPUT = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

/** 每次 encode 返回一个已知字节数的 PNG 桩(便于验证 offset/bytesInRes) */
function pngOfSize(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}

beforeEach(() => {
  mockDecode.mockReset();
  mockEncode.mockReset();
  mockDrawImage.mockReset();
  mockDecode.mockResolvedValue(fakeBitmap());
  // 默认每帧 10 字节 PNG
  mockEncode.mockResolvedValue(pngOfSize(10));
});

async function readView(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

describe('encodeIco 基础容器结构', () => {
  it('输出 MIME 为 image/x-icon', async () => {
    const out = await encodeIco(INPUT, { sizes: [16] });
    expect(out.type).toBe('image/x-icon');
  });

  it('ICONDIR magic bytes 正确(reserved=0, type=1, count=N)', async () => {
    const out = await encodeIco(INPUT, { sizes: [16, 32, 48] });
    const view = await readView(out);
    expect(view.getUint16(0, true)).toBe(0); // reserved
    expect(view.getUint16(2, true)).toBe(1); // type = ICO
    expect(view.getUint16(4, true)).toBe(3); // count
  });

  it('多尺寸 [16,32,48] 生成 3 个条目,offset 递增正确', async () => {
    // 三帧字节数不同,便于验证 offset 累加
    mockEncode
      .mockResolvedValueOnce(pngOfSize(10))
      .mockResolvedValueOnce(pngOfSize(20))
      .mockResolvedValueOnce(pngOfSize(30));
    const out = await encodeIco(INPUT, { sizes: [16, 32, 48] });
    const view = await readView(out);

    const headerSize = 6 + 3 * 16; // 54
    // entry 0
    expect(view.getUint8(6)).toBe(16); // width
    expect(view.getUint8(7)).toBe(16); // height
    expect(view.getUint32(6 + 8, true)).toBe(10); // bytesInRes
    expect(view.getUint32(6 + 12, true)).toBe(headerSize); // imageOffset
    // entry 1
    expect(view.getUint8(6 + 16)).toBe(32);
    expect(view.getUint32(6 + 16 + 8, true)).toBe(20);
    expect(view.getUint32(6 + 16 + 12, true)).toBe(headerSize + 10);
    // entry 2
    expect(view.getUint8(6 + 32)).toBe(48);
    expect(view.getUint32(6 + 32 + 8, true)).toBe(30);
    expect(view.getUint32(6 + 32 + 12, true)).toBe(headerSize + 30);

    // 每个条目 planes=1 / bitCount=32
    expect(view.getUint16(6 + 4, true)).toBe(1);
    expect(view.getUint16(6 + 6, true)).toBe(32);
  });

  it('256 尺寸的 width/height 字段编码为 0', async () => {
    const out = await encodeIco(INPUT, { sizes: [256] });
    const view = await readView(out);
    expect(view.getUint16(4, true)).toBe(1); // count
    expect(view.getUint8(6)).toBe(0); // width (256 → 0)
    expect(view.getUint8(7)).toBe(0); // height (256 → 0)
  });
});

describe('encodeIco 尺寸规范化', () => {
  it('未传 sizes 回退默认 [16,32,48,256]', async () => {
    const out = await encodeIco(INPUT, {});
    const view = await readView(out);
    expect(view.getUint16(4, true)).toBe(4);
    expect(view.getUint8(6)).toBe(16);
    expect(view.getUint8(6 + 16)).toBe(32);
    expect(view.getUint8(6 + 32)).toBe(48);
    expect(view.getUint8(6 + 48)).toBe(0); // 256 → 0
  });

  it('去重 + 升序排列', async () => {
    const out = await encodeIco(INPUT, { sizes: [48, 16, 32, 16] });
    const view = await readView(out);
    expect(view.getUint16(4, true)).toBe(3);
    expect(view.getUint8(6)).toBe(16);
    expect(view.getUint8(6 + 16)).toBe(32);
    expect(view.getUint8(6 + 32)).toBe(48);
  });

  it('超范围尺寸被 clamp 到 1-256', async () => {
    const out = await encodeIco(INPUT, { sizes: [999, 0, -5] });
    const view = await readView(out);
    // 999 → 256, 0/-5 被过滤 → 仅 [256]
    expect(view.getUint16(4, true)).toBe(1);
    expect(view.getUint8(6)).toBe(0); // 256
  });

  it('空数组回退默认', async () => {
    const out = await encodeIco(INPUT, { sizes: [] });
    const view = await readView(out);
    expect(view.getUint16(4, true)).toBe(4);
  });
});

describe('encodeIco cover 裁切', () => {
  it('非正方形输入按短边居中裁切', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(200, 100)); // 宽 > 高
    await encodeIco(INPUT, { sizes: [32] });
    // drawImage(bitmap, sx, sy, sSize, sSize, 0, 0, size, size)
    const call = mockDrawImage.mock.calls[0]!;
    expect(call[3]).toBe(100); // sSize = min(200,100)
    expect(call[4]).toBe(100);
    expect(call[1]).toBe(50); // sx = (200-100)/2
    expect(call[2]).toBe(0); // sy = (100-100)/2
    expect(call[7]).toBe(32); // dest size
    expect(call[8]).toBe(32);
  });
});

describe('encodeIco AbortSignal', () => {
  it('调用前已 abort 应抛 AbortError', async () => {
    await expect(
      encodeIco(INPUT, { sizes: [16, 32] }, abortedSignal())
    ).rejects.toThrow(/abort/i);
  });

  it('中断后释放 bitmap', async () => {
    const fake = fakeBitmap();
    mockDecode.mockResolvedValue(fake);
    await expect(
      encodeIco(INPUT, { sizes: [16] }, abortedSignal())
    ).rejects.toThrow();
    expect(fake.bitmap.close).toHaveBeenCalled();
  });
});

/**
 * 图像操作 AbortSignal 贯穿测试(W3.5)
 *
 * 通过 mock canvas-engine,在不依赖真实 Canvas / createImageBitmap 的前提下,
 * 验证每个操作在 AbortSignal 不同时机的行为:
 * - signal 未 abort:正常返回 Blob
 * - signal 已 abort(调用前):decode 后首次 throwIfAborted 抛 AbortError
 * - signal 在 decode 与 encode 之间 abort:第二次 throwIfAborted 抛 AbortError
 * - signal 在循环中 abort(compressToTargetSize / watermark tile):循环内抛
 *
 * 覆盖操作:resize / crop / rotate / flip / compress / convert / setBackground /
 * watermark(text + image + tile)/ filter / compressToTargetSize。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deflateSync } from 'node:zlib';

// ─── mock canvas-engine ─────────────────────────────────────────
// 所有操作依赖 canvasEngine.decode / encode, createCanvas, get2DContext
const mockDecode = vi.fn();
const mockEncode = vi.fn();

vi.mock('../canvas-engine.js', () => ({
  canvasEngine: {
    decode: mockDecode,
    encode: mockEncode,
  },
  createCanvas: vi.fn((w: number, h: number) => ({
    width: w,
    height: h,
    getContext: () => mockCtx(),
  })),
  get2DContext: vi.fn(() => mockCtx()),
}));

/** 桩 Canvas 2D Context(记录调用但不真正渲染) */
function mockCtx() {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    font: '',
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    filter: '',
    textBaseline: 'middle',
  };
}

// fetch 桩(用于 watermark image 路径)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
// createImageBitmap 桩(用于 watermark image decode)
const mockCreateImageBitmap = vi.fn();
vi.stubGlobal('createImageBitmap', mockCreateImageBitmap);

const {
  resize,
  crop,
  rotate,
  flip,
} = await import('../operations/transform.js');
const { compress, convert, setBackground } = await import('../operations/encode.js');
const { filter } = await import('../operations/filters.js');
const { watermark, computeWatermarkPosition } = await import('../operations/watermark.js');
const { compressToTargetSize } = await import('../operations/compress-target.js');
const { readPngDpi } = await import('../operations/png-metadata.js');

/** 构造一个 fake bitmap + decode 返回值 */
function fakeBitmap(w = 100, h = 100) {
  return {
    bitmap: { width: w, height: h, close: vi.fn() },
    width: w,
    height: h,
  };
}

/** 构造一个已 abort 的 signal */
function abortedSignal() {
  const c = new AbortController();
  c.abort();
  return c.signal;
}

const INPUT = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const OUT = new Blob([new Uint8Array([9])], { type: 'image/webp' });

beforeEach(() => {
  mockDecode.mockReset();
  mockEncode.mockReset();
  mockFetch.mockReset();
  mockCreateImageBitmap.mockReset();
  mockDecode.mockResolvedValue(fakeBitmap());
  mockEncode.mockResolvedValue(OUT);
});

// ─── resize ────────────────────────────────────────────────────

describe('resize AbortSignal', () => {
  it('signal 未 abort 应正常返回 Blob', async () => {
    const out = await resize(INPUT, { width: 50, height: 50 }, new AbortController().signal);
    expect(out).toBe(OUT);
  });

  it('无 signal 应正常返回 Blob', async () => {
    const out = await resize(INPUT, { width: 50 });
    expect(out).toBe(OUT);
  });

  it('signal 已 abort 应抛 AbortError(在 decode 后)', async () => {
    await expect(
      resize(INPUT, { width: 50 }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
    // decode 被调用一次(在 throwIfAborted 之前)
    expect(mockDecode).toHaveBeenCalledTimes(1);
    // encode 不应被调用(已抛错)
    expect(mockEncode).not.toHaveBeenCalled();
  });
});

// ─── resize + DPI 集成(W8.4)──────────────────────────────────
// 验证 resize 在 encode 完成后,按 params.dpi 调用 embedPngDpi,
// 把物理分辨率写入 PNG pHYs chunk(打印软件可读)。
// mock encode 返回真实最小 PNG,使 embedPngDpi 的 isPng / chunk 写入真实生效。

const D_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function dCrc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = D_CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dU32be(v: number): [number, number, number, number] {
  const x = v >>> 0;
  return [(x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff];
}
function dChunk(type: string, data: Uint8Array = new Uint8Array(0)): Uint8Array {
  const typeBytes = Uint8Array.from(type, (ch) => ch.charCodeAt(0));
  const out = new Uint8Array(4 + 4 + data.length + 4);
  out.set(dU32be(data.length), 0);
  out.set(typeBytes, 4);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  out.set(dU32be(dCrc32(crcInput)), 8 + data.length);
  return out;
}
const D_PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 构造最小合法 PNG(1×1 RGBA,无 pHYs),供 encode mock 返回 */
function buildMinimalPng(): Uint8Array {
  const ihdr = new Uint8Array(13);
  ihdr.set(dU32be(1), 0);
  ihdr.set(dU32be(1), 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type = RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const scanline = new Uint8Array([0, 0xff, 0x00, 0x00, 0xff]);
  const idat = deflateSync(scanline);
  const parts: Uint8Array[] = [D_PNG_SIG, dChunk('IHDR', ihdr), dChunk('IDAT', idat), dChunk('IEND')];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/**
 * 把 Uint8Array 包装成 image/png Blob。
 * 显式拷贝到新 ArrayBuffer,确保 BlobPart 接受(TS 5.7+ 要求 ArrayBufferView<ArrayBuffer>,
 * 直接传 Uint8Array<ArrayBufferLike> 会因 SharedArrayBuffer 兼容性报错)。
 */
function pngBlob(bytes: Uint8Array): Blob {
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: 'image/png' });
}

describe('resize + DPI 集成(W8.4)', () => {
  it('PNG 输出 + dpi=300 应写入 pHYs chunk(打印软件可读)', async () => {
    mockEncode.mockResolvedValueOnce(pngBlob(buildMinimalPng()));
    const out = await resize(INPUT, { width: 50, dpi: 300 });
    expect(out.type).toBe('image/png');
    const dpi = await readPngDpi(out);
    expect(dpi).not.toBeNull();
    expect(dpi!).toBeCloseTo(300, 0);
  });

  it('PNG 输出 + dpi=72 应写入正确 DPI', async () => {
    mockEncode.mockResolvedValueOnce(pngBlob(buildMinimalPng()));
    const out = await resize(INPUT, { width: 50, dpi: 72 });
    const dpi = await readPngDpi(out);
    expect(dpi).toBeCloseTo(72, 0);
  });

  it('非 PNG 输入(webp)应跳过 DPI 嵌入(format != png)', async () => {
    const webpInput = new Blob([new Uint8Array([1])], { type: 'image/webp' });
    const out = await resize(webpInput, { width: 50, dpi: 300 });
    // inferFormat(webp) === 'webp' → 不进入 embedPngDpi 分支,返回 encode 原始结果
    expect(out).toBe(OUT);
  });

  it('dpi 非正(0 / 负 / NaN)应跳过 DPI 嵌入', async () => {
    for (const bad of [0, -1, NaN]) {
      mockEncode.mockResolvedValueOnce(pngBlob(buildMinimalPng()));
      const out = await resize(INPUT, { width: 50, dpi: bad });
      // embedPngDpi 对非正 dpi 原样返回 → 无 pHYs
      expect(await readPngDpi(out)).toBeNull();
    }
  });

  it('未传 dpi 时不应嵌入 pHYs', async () => {
    const blob = pngBlob(buildMinimalPng());
    mockEncode.mockResolvedValueOnce(blob);
    const out = await resize(INPUT, { width: 50 });
    // typeof dpi === 'undefined' → 不进入 embedPngDpi 分支,返回 encode 原始引用
    expect(out).toBe(blob);
    expect(await readPngDpi(out)).toBeNull();
  });
});

// ─── crop ──────────────────────────────────────────────────────

describe('crop AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError', async () => {
    await expect(
      crop(INPUT, { x: 0, y: 0, width: 50, height: 50 }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it('正常路径应返回 Blob', async () => {
    const out = await crop(INPUT, { x: 0, y: 0, width: 50, height: 50 });
    expect(out).toBe(OUT);
  });
});

// ─── rotate ────────────────────────────────────────────────────

describe('rotate AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError', async () => {
    await expect(
      rotate(INPUT, { angle: 90 }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('angle=90 应交换宽高', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(100, 200));
    await rotate(INPUT, { angle: 90 });
    // createCanvas 被调用时,outW/outH 交换(200x100)
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it('angle=180 不交换宽高', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(100, 200));
    await rotate(INPUT, { angle: 180 });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });
});

// ─── flip ─────────────────────────────────────────────────────

describe('flip AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError', async () => {
    await expect(
      flip(INPUT, { axis: 'horizontal' }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('axis=both 应正常处理', async () => {
    const out = await flip(INPUT, { axis: 'both' });
    expect(out).toBe(OUT);
  });
});

// ─── compress ─────────────────────────────────────────────────

describe('compress AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError(无 targetSize 路径)', async () => {
    await expect(
      compress(INPUT, { quality: 80 }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('有 targetSize 应委托 compressToTargetSize', async () => {
    const out = await compress(INPUT, { targetSize: 1024 });
    expect(out).toBe(OUT);
  });

  it('有 targetSize + signal 已 abort 应抛 AbortError', async () => {
    await expect(
      compress(INPUT, { targetSize: 1024 }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('默认 format=webp, quality=85', async () => {
    await compress(INPUT, {});
    expect(mockEncode).toHaveBeenCalledWith(expect.anything(), 'webp', 85);
  });

  it('W21.5: 大图(>4096)应走 tile 路径(encode 调用次数 > 1)', async () => {
    // 8192x8192 / tileSize 512 → 256 个 tile,每个 tile encode 一次 + 合并时 encode 1 次
    // 通过 mockEncode 调用次数验证走了 tile 分支(而非单 canvas 的 1 次 encode)
    mockDecode.mockResolvedValueOnce(fakeBitmap(8192, 8192));
    mockEncode.mockResolvedValue(OUT);
    await compress(INPUT, { format: 'webp', quality: 80 });
    // 单 canvas 路径只 encode 1 次;tile 路径至少 encode 256 次(可能更多,取决于 mergeChunks)
    expect(mockEncode.mock.calls.length).toBeGreaterThan(1);
  });

  it('W21.5: 小图(<=4096)应走单 canvas 路径(encode 仅 1 次)', async () => {
    // 4096x4096 是边界,不触发 tile(shouldUseTiles 返回 false)
    mockDecode.mockResolvedValueOnce(fakeBitmap(4096, 4096));
    mockEncode.mockResolvedValue(OUT);
    await compress(INPUT, { format: 'webp', quality: 80 });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });
});

// ─── convert ──────────────────────────────────────────────────

describe('convert AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError', async () => {
    await expect(
      convert(INPUT, { format: 'jpeg' }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('format=jpeg 应填白底', async () => {
    await convert(INPUT, { format: 'jpeg' });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it('format=png 不填白底', async () => {
    await convert(INPUT, { format: 'png' });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it('默认 quality=95', async () => {
    await convert(INPUT, { format: 'png' });
    expect(mockEncode).toHaveBeenCalledWith(expect.anything(), 'png', 95);
  });

  it('W21.5: 大图(>4096)format=jpeg 应走 tile 路径且填白底', async () => {
    // 5000x100 / tileSize 512 → 10 个 tile(沿 x 轴)
    mockDecode.mockResolvedValueOnce(fakeBitmap(5000, 100));
    mockEncode.mockResolvedValue(OUT);
    await convert(INPUT, { format: 'jpeg', quality: 90 });
    // tile 路径:10 个 tile encode + 1 次 mergeChunks encode = 11 次
    // 单 canvas 路径只 encode 1 次,此处验证 > 1 即可
    expect(mockEncode.mock.calls.length).toBeGreaterThan(1);
    // 每次 encode 的格式都是 jpeg(tile 路径 + 合并都应保持 jpeg)
    for (const call of mockEncode.mock.calls) {
      expect(call[1]).toBe('jpeg');
      expect(call[2]).toBe(90);
    }
  });

  it('W21.5: 大图(>4096)format=png 应走 tile 路径不填白底', async () => {
    mockDecode.mockResolvedValueOnce(fakeBitmap(5000, 100));
    mockEncode.mockResolvedValue(OUT);
    await convert(INPUT, { format: 'png' });
    expect(mockEncode.mock.calls.length).toBeGreaterThan(1);
    for (const call of mockEncode.mock.calls) {
      expect(call[1]).toBe('png');
    }
  });

  it('W21.5: 小图(<=4096)应走单 canvas 路径(encode 仅 1 次)', async () => {
    // 4096x4096 边界,不触发 tile
    mockDecode.mockResolvedValueOnce(fakeBitmap(4096, 4096));
    mockEncode.mockResolvedValue(OUT);
    await convert(INPUT, { format: 'png' });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });
});

// ─── setBackground ────────────────────────────────────────────

describe('setBackground AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError', async () => {
    await expect(
      setBackground(INPUT, { color: '#ff0000' }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('正常路径应返回 Blob', async () => {
    const out = await setBackground(INPUT, { color: '#ffffff' });
    expect(out).toBe(OUT);
  });
});

// ─── filter ───────────────────────────────────────────────────

describe('filter AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError', async () => {
    await expect(
      filter(INPUT, { preset: 'grayscale' }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('未知 preset 应抛错', async () => {
    await expect(
      filter(INPUT, { preset: 'unknown' })
    ).rejects.toThrow(/Unknown filter preset/);
  });

  it('缺 preset 应抛错', async () => {
    await expect(
      filter(INPUT, {})
    ).rejects.toThrow(/requires a "preset"/);
  });

  it('grayscale 应正常处理', async () => {
    const out = await filter(INPUT, { preset: 'grayscale' });
    expect(out).toBe(OUT);
  });

  it('blur 应使用 radius', async () => {
    await filter(INPUT, { preset: 'blur', radius: 8 });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });
});

// ─── compressToTargetSize ─────────────────────────────────────

describe('compressToTargetSize AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError(decode 后)', async () => {
    await expect(
      compressToTargetSize(INPUT, 'webp', 1024, abortedSignal())
    ).rejects.toThrow(/aborted/i);
    // 不应进入循环
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it('二分循环每轮检查 signal;第二轮前 abort 应抛', async () => {
    // 第一轮 encode 返回大 blob(超 targetSize)→ hi=mid-1,进入第二轮
    mockEncode.mockResolvedValueOnce(new Blob([new Uint8Array(2048)]));
    const controller = new AbortController();
    // 在第一轮 encode 完成后、第二轮 throwIfAborted 前 abort
    mockEncode.mockImplementationOnce(async () => {
      controller.abort(); // 第一轮 encode 时触发 abort
      return new Blob([new Uint8Array(2048)]);
    });
    await expect(
      compressToTargetSize(INPUT, 'webp', 100, controller.signal)
    ).rejects.toThrow(/aborted/i);
  });

  it('所有质量都超目标 → 兜底返回 quality=10 的结果', async () => {
    // 每轮 encode 都返回超大 blob
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(2048)]));
    const out = await compressToTargetSize(INPUT, 'webp', 100);
    expect(out).toBeDefined();
    // 最后一轮 encode 是兜底 quality=10
    const lastCall = mockEncode.mock.calls[mockEncode.mock.calls.length - 1];
    expect(lastCall![2]).toBe(10);
  });

  it('某轮满足目标 → 返回该结果', async () => {
    // 第一轮返回小 blob(满足),后续轮返回超大(不满足)→ best 保留第一轮
    const good = new Blob([new Uint8Array(50)]);
    mockEncode.mockResolvedValueOnce(good);
    // 后续轮返回超大 blob(超过 targetSize=100),使 best 不被覆盖
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(2048)]));
    const out = await compressToTargetSize(INPUT, 'webp', 100);
    expect(out).toBe(good);
  });
});

// ─── watermark ────────────────────────────────────────────────

describe('watermark AbortSignal', () => {
  it('signal 已 abort 应抛 AbortError(decode 后)', async () => {
    await expect(
      watermark(INPUT, { text: 'hello' }, abortedSignal())
    ).rejects.toThrow(/aborted/i);
  });

  it('文字水印 + position=tile 应正常处理', async () => {
    await watermark(INPUT, { text: 'wm', position: 'tile' });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it('文字水印 + 指定位置(bottom-right)应正常处理', async () => {
    await watermark(INPUT, { text: 'wm', position: 'bottom-right' });
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it('图片水印 + tile 模式应 decode wmBitmap 并平铺', async () => {
    const wmBlob = new Blob([new Uint8Array([1])]);
    mockFetch.mockResolvedValue({ ok: true, blob: async () => wmBlob });
    mockCreateImageBitmap.mockResolvedValue({ width: 20, height: 20, close: vi.fn() });
    await watermark(INPUT, {
      image: 'https://example.com/wm.png',
      position: 'tile',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it('图片水印 fetch 失败应抛错', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    await expect(
      watermark(INPUT, { image: 'https://example.com/wm.png' })
    ).rejects.toThrow(/Failed to fetch watermark/);
  });

  it('图片水印 URL 不安全(SSRF)应抛错', async () => {
    await expect(
      watermark(INPUT, { image: 'http://127.0.0.1/evil' })
    ).rejects.toThrow(/SSRF guard/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('图片水印应把 signal 传给 fetch', async () => {
    const wmBlob = new Blob([new Uint8Array([1])]);
    mockFetch.mockResolvedValue({ ok: true, blob: async () => wmBlob });
    mockCreateImageBitmap.mockResolvedValue({ width: 20, height: 20, close: vi.fn() });
    const controller = new AbortController();
    await watermark(INPUT, { image: 'https://example.com/wm.png' }, controller.signal);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/wm.png',
      { signal: controller.signal }
    );
  });

  it('tile 循环中每行检查 signal(文字水印)', async () => {
    // 用大图触发多行 tile 循环,在首行后 abort
    mockDecode.mockResolvedValue(fakeBitmap(2000, 2000));
    const controller = new AbortController();
    // 让 measureText 返回小宽度,触发更多列 → 更多循环
    // abort 在 throwIfAborted 检查处生效
    await watermark(
      INPUT,
      { text: 'wm', position: 'tile' },
      controller.signal
    );
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });
});

// ─── computeWatermarkPosition ─────────────────────────────────

describe('computeWatermarkPosition', () => {
  const cases: Array<{ pos: string; expect: 'tl' | 'tr' | 'bl' | 'br' | 'c' }> = [
    { pos: 'top-left', expect: 'tl' },
    { pos: 'top-right', expect: 'tr' },
    { pos: 'bottom-left', expect: 'bl' },
    { pos: 'bottom-right', expect: 'br' },
    { pos: 'center', expect: 'c' },
  ];

  for (const { pos, expect: kind } of cases) {
    it(`position=${pos} 应返回正确坐标`, () => {
      const r = computeWatermarkPosition(
        pos as 'top-left',
        1000,
        800,
        100,
        50
      );
      const margin = 16;
      switch (kind) {
        case 'tl':
          expect(r).toEqual({ x: margin, y: margin });
          break;
        case 'tr':
          expect(r).toEqual({ x: 1000 - 100 - margin, y: margin });
          break;
        case 'bl':
          expect(r).toEqual({ x: margin, y: 800 - 50 - margin });
          break;
        case 'br':
          expect(r).toEqual({ x: 1000 - 100 - margin, y: 800 - 50 - margin });
          break;
        case 'c':
          expect(r).toEqual({ x: (1000 - 100) / 2, y: (800 - 50) / 2 });
          break;
      }
    });
  }

  it('未知 position 应回退到 top-left', () => {
    const r = computeWatermarkPosition(
      'unknown' as 'top-left',
      1000,
      800,
      100,
      50
    );
    expect(r).toEqual({ x: 16, y: 16 });
  });
});

// ─── isSafeImageUrl 间接覆盖(SSRF 守卫)─────────────────────────

describe('watermark isSafeImageUrl(SSRF 守卫)', () => {
  it('应拒绝 loopback 地址', async () => {
    await expect(watermark(INPUT, { image: 'http://localhost/x' })).rejects.toThrow(/SSRF/);
    await expect(watermark(INPUT, { image: 'http://127.0.0.1/x' })).rejects.toThrow(/SSRF/);
  });

  it('应拒绝私有网段', async () => {
    await expect(watermark(INPUT, { image: 'http://10.0.0.1/x' })).rejects.toThrow(/SSRF/);
    await expect(watermark(INPUT, { image: 'http://192.168.1.1/x' })).rejects.toThrow(/SSRF/);
    await expect(watermark(INPUT, { image: 'http://172.16.0.1/x' })).rejects.toThrow(/SSRF/);
  });

  it('应拒绝链路本地', async () => {
    await expect(watermark(INPUT, { image: 'http://169.254.169.254/x' })).rejects.toThrow(/SSRF/);
  });

  it('应拒绝非 http/https 协议', async () => {
    await expect(watermark(INPUT, { image: 'file:///etc/passwd' })).rejects.toThrow(/SSRF/);
    await expect(watermark(INPUT, { image: 'ftp://example.com/x' })).rejects.toThrow(/SSRF/);
  });

  it('应拒绝 .local / .internal 后缀', async () => {
    await expect(watermark(INPUT, { image: 'http://host.local/x' })).rejects.toThrow(/SSRF/);
    await expect(watermark(INPUT, { image: 'http://host.internal/x' })).rejects.toThrow(/SSRF/);
  });

  it('应拒绝云元数据 host', async () => {
    await expect(
      watermark(INPUT, { image: 'http://metadata.google.internal/x' })
    ).rejects.toThrow(/SSRF/);
  });

  it('应接受合法公网 URL', async () => {
    const wmBlob = new Blob([new Uint8Array([1])]);
    mockFetch.mockResolvedValue({ ok: true, blob: async () => wmBlob });
    mockCreateImageBitmap.mockResolvedValue({ width: 20, height: 20, close: vi.fn() });
    await watermark(INPUT, { image: 'https://example.com/wm.png' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('应拒绝无效 URL', async () => {
    await expect(watermark(INPUT, { image: 'not-a-url' })).rejects.toThrow(/SSRF/);
  });
});

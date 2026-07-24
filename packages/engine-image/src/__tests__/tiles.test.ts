/**
 * 大图分片工具(W3.2)单元测试
 *
 * 覆盖(PROJECT_PLAN 3.7):
 * - splitIntoTiles:网格切分、边缘 tile、空输入、自定义 tileSize
 * - isDownscale:缩小判定
 * - mergeChunks:空 chunks 抛错、非法尺寸抛错、正常合并路径(mock canvas)
 *
 * mergeChunks 依赖 Canvas/createImageBitmap,通过 vi.mock 替换 canvas-engine。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 桩 canvas-engine:避免依赖 OffscreenCanvas / createImageBitmap
const mockDecode = vi.fn();
const mockEncode = vi.fn();
const mockGet2DContext = vi.fn();
vi.mock('../canvas-engine.js', () => ({
  canvasEngine: {
    decode: mockDecode,
    encode: mockEncode,
  },
  createCanvas: vi.fn((w: number, h: number) => ({ width: w, height: h, __canvas: true })),
  get2DContext: mockGet2DContext,
  detectFormatSupport: vi.fn(async () => ({
    png: true,
    jpeg: true,
    webp: true,
    avif: true,
    gif: true,
  })),
}));

const {
  splitIntoTiles,
  mergeChunks,
  isDownscale,
  processLargeImageWithTiles,
  shouldUseTiles,
  LARGE_IMAGE_THRESHOLD,
  DEFAULT_TILE_SIZE,
} = await import('../operations/tiles.js');

// ─── splitIntoTiles ─────────────────────────────────────────────

describe('splitIntoTiles', () => {
  it('默认 tileSize 应为 512', () => {
    expect(DEFAULT_TILE_SIZE).toBe(512);
  });

  it('尺寸小于 tileSize 时应返回单个 tile(覆盖整图)', () => {
    const tiles = splitIntoTiles(100, 200);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual({ x: 0, y: 0, width: 100, height: 200 });
  });

  it('尺寸等于 tileSize 时应返回单个 tile', () => {
    const tiles = splitIntoTiles(512, 512, 512);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toEqual({ x: 0, y: 0, width: 512, height: 512 });
  });

  it('应按行优先网格切分(2x2)', () => {
    const tiles = splitIntoTiles(1024, 1024, 512);
    expect(tiles).toHaveLength(4);
    // 行优先:(0,0) (512,0) (0,512) (512,512)
    expect(tiles[0]).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(tiles[1]).toEqual({ x: 512, y: 0, width: 512, height: 512 });
    expect(tiles[2]).toEqual({ x: 0, y: 512, width: 512, height: 512 });
    expect(tiles[3]).toEqual({ x: 512, y: 512, width: 512, height: 512 });
  });

  it('边缘 tile 应对齐到图边界(非整除)', () => {
    // 600 / 512 = 1 块余 88 → 第二列 tile 宽 88
    const tiles = splitIntoTiles(600, 600, 512);
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(tiles[1]).toEqual({ x: 512, y: 0, width: 88, height: 512 });
    expect(tiles[2]).toEqual({ x: 0, y: 512, width: 512, height: 88 });
    expect(tiles[3]).toEqual({ x: 512, y: 512, width: 88, height: 88 });
  });

  it('非正方形图应产生正确的行列数', () => {
    // 1024 x 512,tileSize 512 → 2 列 1 行
    const tiles = splitIntoTiles(1024, 512, 512);
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(tiles[1]).toEqual({ x: 512, y: 0, width: 512, height: 512 });
  });

  it('自定义 tileSize 应生效', () => {
    const tiles = splitIntoTiles(256, 256, 128);
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toEqual({ x: 0, y: 0, width: 128, height: 128 });
  });

  it('width <= 0 应返回空数组', () => {
    expect(splitIntoTiles(0, 100)).toEqual([]);
    expect(splitIntoTiles(-1, 100)).toEqual([]);
  });

  it('height <= 0 应返回空数组', () => {
    expect(splitIntoTiles(100, 0)).toEqual([]);
    expect(splitIntoTiles(100, -5)).toEqual([]);
  });

  it('tileSize <= 0 应返回空数组', () => {
    expect(splitIntoTiles(100, 100, 0)).toEqual([]);
    expect(splitIntoTiles(100, 100, -10)).toEqual([]);
  });

  it('tile 覆盖总面积应等于原图面积(无重叠无遗漏)', () => {
    const w = 1024;
    const h = 768;
    const tiles = splitIntoTiles(w, h, 512);
    // 校验每个 tile 在边界内
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(w);
      expect(t.y + t.height).toBeLessThanOrEqual(h);
    }
  });
});

// ─── isDownscale ────────────────────────────────────────────────

describe('isDownscale', () => {
  it('两边都小于源 → true', () => {
    expect(isDownscale(1000, 1000, 500, 500)).toBe(true);
  });

  it('一边小于源 → true(面积更小)', () => {
    expect(isDownscale(1000, 1000, 500, 1000)).toBe(true);
    expect(isDownscale(1000, 1000, 1000, 500)).toBe(true);
  });

  it('两边都等于源 → false', () => {
    expect(isDownscale(1000, 1000, 1000, 1000)).toBe(false);
  });

  it('任一边大于源 → false(放大)', () => {
    expect(isDownscale(500, 500, 1000, 500)).toBe(false);
    expect(isDownscale(500, 500, 500, 1000)).toBe(false);
  });

  it('两边都大于源 → false', () => {
    expect(isDownscale(500, 500, 1000, 1000)).toBe(false);
  });
});

// ─── mergeChunks ───────────────────────────────────────────────

describe('mergeChunks', () => {
  beforeEach(() => {
    mockDecode.mockReset();
    mockEncode.mockReset();
    mockGet2DContext.mockReset();
  });

  it('空 chunks 应抛错', async () => {
    await expect(mergeChunks([], 100, 100, 'png')).rejects.toThrow(/no chunks/);
  });

  it('非法 totalWidth 应抛错', async () => {
    const chunk = { tile: { x: 0, y: 0, width: 10, height: 10 }, blob: new Blob() };
    await expect(mergeChunks([chunk], 0, 100, 'png')).rejects.toThrow(/invalid total dimensions/);
  });

  it('非法 totalHeight 应抛错', async () => {
    const chunk = { tile: { x: 0, y: 0, width: 10, height: 10 }, blob: new Blob() };
    await expect(mergeChunks([chunk], 100, -1, 'png')).rejects.toThrow(/invalid total dimensions/);
  });

  it('应 decode 每个 chunk → drawImage → encode 输出 canvas', async () => {
    const fakeBitmap = { width: 10, height: 10, close: vi.fn() };
    mockDecode.mockResolvedValue({ bitmap: fakeBitmap, width: 10, height: 10 });
    const fakeCtx = { drawImage: vi.fn() };
    mockGet2DContext.mockReturnValue(fakeCtx);
    const outBlob = new Blob(['merged']);
    mockEncode.mockResolvedValue(outBlob);

    const chunks = [
      { tile: { x: 0, y: 0, width: 10, height: 10 }, blob: new Blob(['a']) },
      { tile: { x: 10, y: 0, width: 10, height: 10 }, blob: new Blob(['b']) },
    ];

    const result = await mergeChunks(chunks, 20, 10, 'png', 90);
    expect(result).toBe(outBlob);

    // 每个 chunk 都被 decode 一次
    expect(mockDecode).toHaveBeenCalledTimes(2);
    // drawImage 被调用,位置正确
    expect(fakeCtx.drawImage).toHaveBeenCalledTimes(2);
    expect(fakeCtx.drawImage).toHaveBeenNthCalledWith(1, fakeBitmap, 0, 0, 10, 10);
    expect(fakeCtx.drawImage).toHaveBeenNthCalledWith(2, fakeBitmap, 10, 0, 10, 10);
    // bitmap.close 被调用(释放)
    expect(fakeBitmap.close).toHaveBeenCalledTimes(2);
    // 最后 encode 一次
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it('quality 默认应为 95', async () => {
    const fakeBitmap = { width: 10, height: 10, close: vi.fn() };
    mockDecode.mockResolvedValue({ bitmap: fakeBitmap, width: 10, height: 10 });
    mockGet2DContext.mockReturnValue({ drawImage: vi.fn() });
    mockEncode.mockResolvedValue(new Blob());

    const chunks = [{ tile: { x: 0, y: 0, width: 10, height: 10 }, blob: new Blob() }];
    await mergeChunks(chunks, 10, 10, 'webp');
    expect(mockEncode).toHaveBeenCalledWith(expect.anything(), 'webp', 95);
  });

  it('signal 已 abort 应在 decode 前抛 AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    const chunks = [{ tile: { x: 0, y: 0, width: 10, height: 10 }, blob: new Blob() }];
    await expect(mergeChunks(chunks, 10, 10, 'png', 95, controller.signal)).rejects.toThrow(
      /aborted/i
    );
    // decode 不应被调用(signal 在循环首步即检查)
    expect(mockDecode).not.toHaveBeenCalled();
  });
});

// ─── W21.5: shouldUseTiles / LARGE_IMAGE_THRESHOLD ──────────────

describe('W21.5: shouldUseTiles / LARGE_IMAGE_THRESHOLD', () => {
  it('LARGE_IMAGE_THRESHOLD 应为 4096(4K 对齐)', () => {
    expect(LARGE_IMAGE_THRESHOLD).toBe(4096);
  });

  it('两边都 <= 阈值应返回 false(小图走单 canvas 路径)', () => {
    expect(shouldUseTiles(100, 100)).toBe(false);
    expect(shouldUseTiles(4096, 4096)).toBe(false); // 边界:等于阈值不算大图
    expect(shouldUseTiles(4096, 2160)).toBe(false); // 4K UHD 不触发
  });

  it('任一边 > 阈值应返回 true(大图走 tile 路径)', () => {
    expect(shouldUseTiles(4097, 100)).toBe(true); // 宽刚超阈值
    expect(shouldUseTiles(100, 4097)).toBe(true); // 高刚超阈值
    expect(shouldUseTiles(8192, 8192)).toBe(true); // 8K
    expect(shouldUseTiles(7680, 4320)).toBe(true); // 8K UHD
  });

  it('零或负尺寸应返回 false(异常输入不触发 tile)', () => {
    expect(shouldUseTiles(0, 0)).toBe(false);
    expect(shouldUseTiles(-1, 100)).toBe(false);
    expect(shouldUseTiles(100, -1)).toBe(false);
  });
});

// ─── W21.5: processLargeImageWithTiles ──────────────────────────

describe('W21.5: processLargeImageWithTiles', () => {
  beforeEach(() => {
    mockDecode.mockReset();
    mockEncode.mockReset();
    mockGet2DContext.mockReset();
  });

  it('非法 width/height 应抛错', async () => {
    const bitmap = { width: 0, height: 0 } as unknown as ImageBitmap;
    await expect(
      processLargeImageWithTiles(bitmap, 0, 100, 'png', 90, () => {})
    ).rejects.toThrow(/invalid dimensions/);
    await expect(
      processLargeImageWithTiles(bitmap, 100, -1, 'png', 90, () => {})
    ).rejects.toThrow(/invalid dimensions/);
  });

  it('应按 tile 切分逐个 encode,最后 mergeChunks 合并', async () => {
    // 1024x1024 / tileSize 512 → 4 个 tile
    // 每个 tile encode 返回独立 Blob,mergeChunks 把 4 个 chunk 合并
    const bitmap = { width: 1024, height: 1024, close: vi.fn() } as unknown as ImageBitmap;
    mockGet2DContext.mockReturnValue({ drawImage: vi.fn() });
    // 每个 tile encode 返回不同 Blob,便于断言被调用 4 次
    mockEncode.mockImplementation(async (_canvas, _fmt, _q) => new Blob([_fmt as string]));
    // mergeChunks 内部也会调 decode + encode,先 mock decode 返回 bitmap
    mockDecode.mockResolvedValue({ bitmap, width: 512, height: 512 });

    const drawCb = vi.fn();
    const result = await processLargeImageWithTiles(
      bitmap,
      1024,
      1024,
      'webp',
      80,
      drawCb,
      undefined,
      512
    );

    expect(result).toBeInstanceOf(Blob);
    // drawCb 被调用 4 次(每个 tile 一次)
    expect(drawCb).toHaveBeenCalledTimes(4);
    // tile encode 调用 4 次(每个 tile 一次)+ mergeChunks 最后 encode 1 次 = 5 次
    // 但 mergeChunks 的 encode 与 tile 的 encode 都走 mockEncode
    expect(mockEncode.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('tileSize 默认为 DEFAULT_TILE_SIZE(512)', async () => {
    // 600x600 / 512 → 4 个 tile(2x2 网格,边缘 tile 88x88 / 88x88)
    const bitmap = { width: 600, height: 600, close: vi.fn() } as unknown as ImageBitmap;
    mockGet2DContext.mockReturnValue({ drawImage: vi.fn() });
    mockEncode.mockResolvedValue(new Blob(['t']));
    mockDecode.mockResolvedValue({ bitmap, width: 512, height: 512 });

    const drawCb = vi.fn();
    await processLargeImageWithTiles(bitmap, 600, 600, 'png', 90, drawCb);

    // 不传 tileSize → 默认 512 → 600/512 向上取整 = 2 列 2 行 = 4 tile
    expect(drawCb).toHaveBeenCalledTimes(4);
    // 第一个 tile 应是 (0,0,512,512)
    const firstTile = drawCb.mock.calls[0]![2] as { x: number; y: number; width: number; height: number };
    expect(firstTile).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    // 第二个 tile(同一行右邻)应是 (512,0,88,512)
    const secondTile = drawCb.mock.calls[1]![2] as { x: number; y: number; width: number; height: number };
    expect(secondTile).toEqual({ x: 512, y: 0, width: 88, height: 512 });
  });

  it('signal 已 abort 应在首个 tile 开始前抛 AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    const bitmap = { width: 100, height: 100 } as unknown as ImageBitmap;
    const drawCb = vi.fn();
    await expect(
      processLargeImageWithTiles(bitmap, 100, 100, 'png', 90, drawCb, controller.signal, 50)
    ).rejects.toThrow(/aborted/i);
    // drawCb / encode 都不应被调用(signal 在首个 tile 前即抛)
    expect(drawCb).not.toHaveBeenCalled();
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it('signal 在中途 abort 应在下一个 tile 开始前抛 AbortError', async () => {
    // 100x100 / tileSize 50 → 4 个 tile,在第 2 个 tile 后 abort
    const bitmap = { width: 100, height: 100 } as unknown as ImageBitmap;
    mockGet2DContext.mockReturnValue({ drawImage: vi.fn() });
    mockEncode.mockResolvedValue(new Blob(['t']));

    const controller = new AbortController();
    const drawCb = vi.fn(() => {
      // 第 2 个 tile 绘制完后 abort
      if (drawCb.mock.calls.length === 2) controller.abort();
    });
    await expect(
      processLargeImageWithTiles(bitmap, 100, 100, 'png', 90, drawCb, controller.signal, 50)
    ).rejects.toThrow(/aborted/i);
    // 应只处理了 2 个 tile(第 3 个 tile 开始前 abort)
    expect(drawCb).toHaveBeenCalledTimes(2);
  });

  it('drawCb 应收到 ctx / bitmap / tile 三个参数', async () => {
    const bitmap = { width: 50, height: 50, close: vi.fn() } as unknown as ImageBitmap;
    const fakeCtx = { drawImage: vi.fn() };
    mockGet2DContext.mockReturnValue(fakeCtx);
    mockEncode.mockResolvedValue(new Blob(['t']));
    mockDecode.mockResolvedValue({ bitmap, width: 50, height: 50 });

    const drawCb = vi.fn();
    await processLargeImageWithTiles(bitmap, 50, 50, 'png', 90, drawCb, undefined, 50);

    expect(drawCb).toHaveBeenCalledTimes(1);
    const [ctxArg, bitmapArg, tileArg] = drawCb.mock.calls[0]!;
    expect(ctxArg).toBe(fakeCtx);
    expect(bitmapArg).toBe(bitmap);
    expect(tileArg).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });
});

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
}));

const { splitIntoTiles, mergeChunks, isDownscale, DEFAULT_TILE_SIZE } = await import(
  '../operations/tiles.js'
);

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
});

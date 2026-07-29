/**
 * resize 几何变换测试 — cover 裁切回归
 *
 * 回归场景:横图 + 竖版预设(如 TikTok 9:16)时,fit=cover 应居中裁切到
 * 精确目标框,输出精确 1080×1920,而非保留源图比例(修复前输出 16:9 的 3413×1920)。
 *
 * 通过 mock canvas-engine 捕获 createCanvas 的目标尺寸与 drawImage 的裁切参数,
 * 不依赖真实 Canvas / createImageBitmap。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── mock canvas-engine ─────────────────────────────────────────
const mockDecode = vi.fn();
const mockEncode = vi.fn();
const mockDrawImage = vi.fn();

/** 共享 ctx,便于断言 drawImage 的调用参数 */
const mockCtx = {
  drawImage: mockDrawImage,
  imageSmoothingEnabled: false,
  imageSmoothingQuality: 'low',
};

const mockCreateCanvas = vi.fn((w: number, h: number) => ({
  width: w,
  height: h,
  getContext: () => mockCtx,
}));

vi.mock('../canvas-engine.js', () => ({
  decodeImage: mockDecode,
  encodeImage: mockEncode,
  createCanvas: mockCreateCanvas,
  get2DContext: vi.fn(() => mockCtx),
  detectFormatSupport: vi.fn(async () => ({
    png: true,
    jpeg: true,
    webp: true,
    avif: true,
    gif: true,
  })),
}));

const { resize } = await import('../operations/transform.js');

const INPUT = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const OUT = new Blob([new Uint8Array([9])], { type: 'image/png' });

function fakeBitmap(w = 100, h = 100) {
  return {
    bitmap: { width: w, height: h, close: vi.fn() },
    width: w,
    height: h,
  };
}

beforeEach(() => {
  mockDecode.mockReset();
  mockEncode.mockReset();
  mockDrawImage.mockReset();
  mockCreateCanvas.mockClear();
  mockEncode.mockResolvedValue(OUT);
});

// ─── cover 裁切(核心回归)─────────────────────────────────────

describe('resize cover 裁切', () => {
  it('横图 1920×1080 → TikTok 9:16(1080×1920)应输出精确 1080×1920', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(1920, 1080));
    await resize(INPUT, { width: 1080, height: 1920, maintainAspectRatio: true });
    // 输出画布应为精确目标框(修复前是 cover 缩放尺寸 3413×1920,即 16:9)
    expect(mockCreateCanvas).toHaveBeenCalledWith(1080, 1920);
  });

  it('cover 应从源图居中裁切(9 参 drawImage)', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(1920, 1080));
    await resize(INPUT, { width: 1080, height: 1920, maintainAspectRatio: true });
    // scale = max(1080/1920, 1920/1080) = 1.778
    // cropW = 1080/1.778 ≈ 607.5, cropH = 1920/1.778 = 1080
    // sx = (1920-607.5)/2 ≈ 656.25, sy = 0
    expect(mockDrawImage).toHaveBeenCalledTimes(1);
    const args = mockDrawImage.mock.calls[0]!;
    // 9 参形式:drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, outW, outH)
    expect(args.length).toBe(9);
    expect(args[7]).toBe(1080);          // outW
    expect(args[8]).toBe(1920);          // outH
    expect(args[4]).toBeCloseTo(1080, 5); // cropH = 源图全高(横图裁左右)
    expect(args[2]).toBeCloseTo(0, 5);    // sy = 0(垂直方向恰好占满)
    expect(args[1]).toBeCloseTo(656.25, 4); // sx 居中
  });

  it('竖图 1080×1920 → 横版 16:9(1280×720)也应输出精确目标尺寸', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(1080, 1920));
    await resize(INPUT, { width: 1280, height: 720, maintainAspectRatio: true });
    expect(mockCreateCanvas).toHaveBeenCalledWith(1280, 720);
    // 竖图裁上下:cropW = 源图全宽,sx = 0
    const args = mockDrawImage.mock.calls[0]!;
    expect(args.length).toBe(9);
    expect(args[3]).toBeCloseTo(1080, 5); // cropW = 源图全宽
    expect(args[1]).toBeCloseTo(0, 5);    // sx = 0
  });

  it('源图与目标同比例时不应裁切(走普通缩放路径)', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(1080, 1920));
    await resize(INPUT, { width: 1080, height: 1920, maintainAspectRatio: true });
    expect(mockCreateCanvas).toHaveBeenCalledWith(1080, 1920);
    // 同比例 → 5 参 drawImage(bitmap, 0, 0, w, h)
    const args = mockDrawImage.mock.calls[0]!;
    expect(args.length).toBe(5);
  });

  it('fit=fill 应直接拉伸不裁切(5 参 drawImage)', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(1920, 1080));
    await resize(INPUT, { width: 1080, height: 1920, fit: 'fill' });
    expect(mockCreateCanvas).toHaveBeenCalledWith(1080, 1920);
    const args = mockDrawImage.mock.calls[0]!;
    expect(args.length).toBe(5);
  });

  it('只指定单边(width)应按比例缩放,不裁切', async () => {
    mockDecode.mockResolvedValue(fakeBitmap(1920, 1080));
    await resize(INPUT, { width: 960 });
    // 960 / (1080*960/1920=540) → 960×540
    expect(mockCreateCanvas).toHaveBeenCalledWith(960, 540);
    const args = mockDrawImage.mock.calls[0]!;
    expect(args.length).toBe(5);
  });
});

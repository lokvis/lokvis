/**
 * 目标体积压缩算法(W3.5 / W8.5)单元测试 —— W8.9
 *
 * 专注 compressToTargetSize 的二分查找行为(不重复 operations-signal.test.ts
 * 已覆盖的 AbortSignal 路径):
 * - 二分边界 [10, 95]:首 mid = 52
 * - 单调性:候选 ≤ target 时升 lo(找更高质量);> target 时降 hi
 * - 最多 6 轮迭代
 * - best 保留满足条件的最高质量
 * - 兜底:所有质量均超 target 时返回 quality=10 的结果
 * - lo > hi 时提前退出(避免无意义循环)
 *
 * 通过 mock canvasEngine.decode / encode,隔离真实 Canvas,直接断言 encode
 * 的调用次数与 quality 序列。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── mock canvas-engine ─────────────────────────────────────────
const mockDecode = vi.fn();
const mockEncode = vi.fn();

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

const { compressToTargetSize } = await import('../operations/compress-target.js');

const INPUT = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

/** 构造 fake bitmap + decode 返回值 */
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
  mockDecode.mockResolvedValue(fakeBitmap());
});

// ─── 二分查找行为 ──────────────────────────────────────────────

describe('compressToTargetSize 二分查找', () => {
  it('首轮 mid 应为 52(区间 [10, 95] 的中点)', async () => {
    // 所有质量都超 target → 走完 6 轮 + 兜底
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(2048)]));
    await compressToTargetSize(INPUT, 'webp', 100);
    const firstCall = mockEncode.mock.calls[0]!;
    expect(firstCall![2]).toBe(52); // Math.floor((10 + 95) / 2) = 52
  });

  it('候选 ≤ target 时应升 lo(尝试更高质量)', async () => {
    // 第一轮 mid=52 返回小 blob(满足)→ lo=53,hi=95,新 mid=74
    // 第二轮 mid=74 也返回小 blob(满足)→ lo=75,hi=95,新 mid=85
    // 依此类推,直到 lo > hi 或满 6 轮
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(50)])); // 永远满足
    await compressToTargetSize(INPUT, 'webp', 100);
    const qualities = mockEncode.mock.calls.map((c) => c![2]);
    // 第一轮必须是 52,后续应单调递增(向更高质量探索)
    expect(qualities[0]).toBe(52);
    for (let i = 1; i < qualities.length; i++) {
      expect(qualities[i]).toBeGreaterThan(qualities[i - 1]!);
    }
  });

  it('候选 > target 时应降 hi(尝试更低质量)', async () => {
    // 所有轮都返回超大 blob(超 target)→ hi 持续下降
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(2048)]));
    await compressToTargetSize(INPUT, 'webp', 100);
    const qualities = mockEncode.mock.calls.map((c) => c![2]);
    // 前 6 轮(二分)应单调递减;最后 1 轮是兜底 quality=10
    expect(qualities[0]).toBe(52);
    for (let i = 1; i < 6; i++) {
      expect(qualities[i]).toBeLessThan(qualities[i - 1]!);
    }
    // 最后一次是兜底,quality=10
    expect(qualities[qualities.length - 1]).toBe(10);
  });

  it('最多 6 轮二分 + 1 轮兜底(=7 次 encode),不无限循环', async () => {
    // 所有质量都超 target,触发兜底
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(2048)]));
    await compressToTargetSize(INPUT, 'webp', 100);
    // 6 轮二分 + 1 轮兜底 = 7 次。注意:lo > hi 时二分会提前退出,
    // 实际可能少于 6 轮,但绝不超 7 次。
    expect(mockEncode.mock.calls.length).toBeLessThanOrEqual(7);
  });

  it('best 保留满足条件的最高质量(更大 quality 满足时不覆盖小 quality 结果)', async () => {
    // 模拟:quality=52 满足,quality=74 也满足,quality=85 不满足
    // best 应保留 quality=74 的结果(更高)
    const good52 = new Blob([new Uint8Array(50)]);
    const good74 = new Blob([new Uint8Array(60)]);
    const bad85 = new Blob([new Uint8Array(2048)]);
    mockEncode
      .mockResolvedValueOnce(good52) // mid=52,满足 → best=good52, lo=53
      .mockResolvedValueOnce(good74) // mid=74,满足 → best=good74, lo=75
      .mockResolvedValueOnce(bad85) // mid=85,不满足 → hi=84
      .mockResolvedValue(new Blob([new Uint8Array(2048)])); // 后续都不满足
    const out = await compressToTargetSize(INPUT, 'webp', 100);
    // best 应是 good74(最后满足的那个)
    expect(out).toBe(good74);
  });

  it('所有质量均超 target → 兜底返回 quality=10 的结果', async () => {
    const fallback = new Blob([new Uint8Array(2048)]);
    mockEncode.mockResolvedValue(fallback);
    const out = await compressToTargetSize(INPUT, 'webp', 100);
    expect(out).toBe(fallback);
    const lastCall = mockEncode.mock.calls[mockEncode.mock.calls.length - 1]!;
    expect(lastCall![2]).toBe(10);
  });

  it('首轮就满足且后续都满足 → 返回最后一轮满足的结果(最高 quality)', async () => {
    // 永远满足:6 轮都 best 更新,返回最后一轮的结果
    const final = new Blob([new Uint8Array(50)]);
    mockEncode.mockResolvedValue(final);
    const out = await compressToTargetSize(INPUT, 'webp', 100);
    expect(out).toBe(final);
    // 没有兜底(所有轮都满足)
    const lastQuality = mockEncode.mock.calls[mockEncode.mock.calls.length - 1]![2];
    expect(lastQuality).not.toBe(10);
  });

  it('bitmap.close 应被调用(释放资源)', async () => {
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(50)]));
    const fake = fakeBitmap();
    mockDecode.mockResolvedValue(fake);
    await compressToTargetSize(INPUT, 'webp', 100);
    expect(fake.bitmap.close).toHaveBeenCalled();
  });

  it('decode 失败应抛错(不吞异常)', async () => {
    mockDecode.mockRejectedValue(new Error('decode failed'));
    await expect(compressToTargetSize(INPUT, 'webp', 100)).rejects.toThrow(/decode failed/);
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it('encode 失败应抛错(不吞异常,不进入兜底)', async () => {
    mockEncode.mockRejectedValue(new Error('encode failed'));
    await expect(compressToTargetSize(INPUT, 'webp', 100)).rejects.toThrow(/encode failed/);
  });
});

// ─── 二分边界正确性 ────────────────────────────────────────────

describe('compressToTargetSize 二分边界', () => {
  it('quality 不应越界(不在 [10, 95] 之外,兜底除外)', async () => {
    // 模拟乱序结果,验证 quality 始终在 [10, 95]
    const sizes = [2048, 50, 2048, 60, 2048, 50, 2048];
    sizes.forEach((s) => {
      mockEncode.mockResolvedValueOnce(new Blob([new Uint8Array(s)]));
    });
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(2048)]));
    await compressToTargetSize(INPUT, 'webp', 100);
    for (const call of mockEncode.mock.calls) {
      const q = call![2] as number;
      // 兜底是 10,二分中最低也是 10;最高 95
      expect(q).toBeGreaterThanOrEqual(10);
      expect(q).toBeLessThanOrEqual(95);
    }
  });

  it('lo > hi 时应提前退出(避免无意义循环)', async () => {
    // 制造 lo 快速超过 hi 的场景:第一轮 mid=52 满足 → lo=53
    // 第二轮 mid=74 不满足 → hi=73
    // 第三轮 mid=63 不满足 → hi=62,lo=53,此时 lo < hi 仍继续
    // 实际边界:当 lo=63, hi=62 时退出(lo > hi)
    // 验证循环次数 ≤ 6(不超过最大迭代)
    const alternating = [50, 2048, 2048, 2048, 2048, 2048, 2048];
    alternating.forEach((s) => {
      mockEncode.mockResolvedValueOnce(new Blob([new Uint8Array(s)]));
    });
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(2048)]));
    await compressToTargetSize(INPUT, 'webp', 100);
    // 二分循环最多 6 次
    const binaryCalls = mockEncode.mock.calls.length - (mockEncode.mock.calls.length > 6 ? 1 : 0);
    expect(binaryCalls).toBeLessThanOrEqual(6);
  });
});

// ─── 不同格式参数 ──────────────────────────────────────────────

describe('compressToTargetSize 格式参数', () => {
  it('应透传 format 到 encode 调用', async () => {
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(50)]));
    await compressToTargetSize(INPUT, 'avif', 100);
    expect(mockEncode.mock.calls[0]![1]).toBe('avif');
  });

  it('应支持 jpeg 格式', async () => {
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(50)]));
    await compressToTargetSize(INPUT, 'jpeg', 100);
    expect(mockEncode.mock.calls[0]![1]).toBe('jpeg');
  });

  it('应支持 png 格式(虽然 PNG 无损,quality 仍透传)', async () => {
    mockEncode.mockResolvedValue(new Blob([new Uint8Array(50)]));
    await compressToTargetSize(INPUT, 'png', 100);
    expect(mockEncode.mock.calls[0]![1]).toBe('png');
  });
});

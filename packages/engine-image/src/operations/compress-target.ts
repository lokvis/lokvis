/**
 * 目标体积压缩算法:二分查找最佳质量
 *
 * 独立成文件便于单测:
 * - 给定目标体积,二分查找 [10, 95] 区间内满足的最大质量
 * - 最多迭代 6 次,平衡精度与耗时
 *
 * W3.5:二分循环每轮检查 AbortSignal,使 cancel 能在 6 次编码中途生效
 * (这是最易被 cancel 卡住的耗时点)。
 *
 * W21.6:bitmap 资源用 try/finally 释放,确保 throwIfAborted 抛错时
 * ImageBitmap 不会泄漏。
 */
import type { ImageOutputFormat } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';
import { throwIfAborted } from './utils.js';
import { encodeSmart } from './wasm-encode.js';

/** 目标体积压缩：二分查找质量 */
export async function compressToTargetSize(
  blob: Blob,
  format: ImageOutputFormat,
  targetSize: number,
  signal?: AbortSignal
): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  try {
    throwIfAborted(signal);
    const canvas = createCanvas(width, height);
    const ctx = get2DContext(canvas);
    ctx.drawImage(bitmap, 0, 0);

    // 修复 review 报告：二分边界
    //   - 原 `for (i < 6)` 无 `lo <= hi` 检查，当 lo 超过 hi 后 mid 仍在 [lo,hi] 之外
    //     （如 lo=96, hi=95 → mid=95，下一轮 lo=96, hi=94 → mid=95，重复无意义）
    //   - 兜底 `await encode(canvas, format, lo)` 在 lo 被升到 96 时会传越界 quality，
    //     encode 行为未定义。改用循环条件 `lo <= hi` + 兜底固定为 lo 初始下界 10
    let lo = 10;
    let hi = 95;
    let best: Blob | null = null;
    for (let i = 0; i < 6 && lo <= hi; i++) {
      throwIfAborted(signal); // 每轮编码前检查,避免 cancel 后继续做昂贵的 encode
      const mid = Math.floor((lo + hi) / 2);
      const candidate = await encodeSmart(canvas, format, mid, signal);
      if (candidate.size <= targetSize) {
        best = candidate;
        lo = mid + 1; // 尝试更高质量
      } else {
        hi = mid - 1;
      }
    }
    // 如果所有质量都超目标，返回最低质量结果（10 是 lo 下界，安全值）
    if (!best) {
      throwIfAborted(signal);
      best = await encodeSmart(canvas, format, 10, signal);
    }
    throwIfAborted(signal);
    return best;
  } finally {
    bitmap.close?.();
  }
}

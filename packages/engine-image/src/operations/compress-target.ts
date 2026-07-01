/**
 * 目标体积压缩算法:二分查找最佳质量
 *
 * 独立成文件便于单测:
 * - 给定目标体积,二分查找 [10, 95] 区间内满足的最大质量
 * - 最多迭代 6 次,平衡精度与耗时
 */
import type { ImageOutputFormat } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';

/** 目标体积压缩：二分查找质量 */
export async function compressToTargetSize(
  blob: Blob,
  format: ImageOutputFormat,
  targetSize: number
): Promise<Blob> {
  const { bitmap, width, height } = await canvasEngine.decode(blob);
  const canvas = createCanvas(width, height);
  const ctx = get2DContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let lo = 10;
  let hi = 95;
  let best: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await canvasEngine.encode(canvas, format, mid);
    if (candidate.size <= targetSize) {
      best = candidate;
      lo = mid + 1; // 尝试更高质量
    } else {
      hi = mid - 1;
    }
  }
  // 如果所有质量都超目标，返回最低质量结果
  if (!best) {
    best = await canvasEngine.encode(canvas, format, lo);
  }
  return best;
}

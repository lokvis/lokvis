/**
 * 内存阈值监测与 OPFS 溢出(W3.3)
 *
 * 目标(对应 whitepaper T1「浏览器内存/性能 ★★★★★」):
 * 浏览器单 tab 内存有限(桌面典型 2-4GB,移动端更少),大图批量处理
 * 极易触发 OOM 崩溃(整个 tab 被杀,丢失所有中间结果)。MemoryGuard 通过
 * 显式追踪中间结果占用 + 周期性压力评估,在逼近预算时把中间 Blob 溢出
 * 到 OPFS,把"OPFS 当虚拟内存用"——内存里只留当前活跃的一两个 Blob。
 *
 * 设计取舍:
 * - tracked:显式登记的中间分配(decode 结果、canvas 输出等大对象)。
 *   相比 `performance.memory`(Chrome-only、deprecated、MB 粒度、跨浏览器
 *   不可用),tracked 是可控、可测、确定性的信号,适合做预算判定主依据。
 * - budget:512MB(经验值——留出 JS runtime / DOM / 其他 tab 的余量,
 *   实际由 RuntimeConfig.memoryBudget 传入,默认 512MB)。
 * - pressure:low(<60%) / elevated(60-80%) / high(80-95%) / critical(≥95%)。
 * - shouldSpill:pressure >= high 时建议把当前中间结果落 OPFS。
 * - spill/restore/evict:经由 AssetStore(OPFS-backed when available;
 *   runtime 已用 wrapAssetStoreWithQuota 包裹,溢出受 storageQuota 约束,
 *   避免无限溢出把磁盘填满)。
 *
 * 集成方式(由 W3.4 degradation 编排):
 *   const guard = new MemoryGuard({ budget, assetStore });
 *   const alloc = guard.track(blob.size);          // 登记
 *   if (guard.shouldSpill()) { const a = await guard.spill(blob); blob = null; }  // 溢出
 *   ...
 *   alloc.release();                                // 回退
 */

import type { Asset, AssetMetadata } from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';

/** 默认内存预算:512MB(见上) */
export const DEFAULT_MEMORY_BUDGET = 512 * 1024 * 1024;

/** 内存压力等级(降级阶梯 W3.4 据此选择策略) */
export type MemoryPressure = 'low' | 'elevated' | 'high' | 'critical';

export interface MemoryGuardOptions {
  /** 总内存预算(字节),超出 high 阈值则建议溢出 */
  budget?: number;
  /** elevated 阈值占 budget 比例(默认 0.6) */
  elevatedRatio?: number;
  /** high 阈值(默认 0.8):达到则 shouldSpill=true */
  highRatio?: number;
  /** critical 阈值(默认 0.95):达到则降级阶梯走 L4 拒绝 */
  criticalRatio?: number;
  /** 溢出目标(通常为 OPFS-backed AssetStore);不提供则 shouldSpill 永远 false */
  assetStore?: AssetStore;
}

/** track() 返回的分配句柄:丢弃引用时调用 release() 回退计数(幂等) */
export interface MemoryAllocation {
  /** 该笔登记的字节数 */
  readonly bytes: number;
  /** 回退登记;重复调用幂等(仅首次生效) */
  release(): void;
}

/**
 * 估算解码后位图占用的内存(RGBA,4 字节/像素)。
 *
 * 一个 4000×3000 的 JPEG,blob 可能只有 2MB,但 decode 成 ImageBitmap 后
 * 占 4000*3000*4 ≈ 46MB。追踪中间结果时应以此为准而非 blob.size,
 * 否则严重低估内存压力。
 */
export function estimateDecodedBytes(width: number, height: number): number {
  return Math.max(0, Math.round(width * height * 4));
}

/** 估算 Blob 在内存中占用的字节数(对未解码的 Blob,以其 size 为准) */
export function estimateBlobBytes(blob: Blob): number {
  return blob.size;
}

/** 内存守卫:追踪中间结果占用 + 触发 OPFS 溢出 */
export class MemoryGuard {
  private tracked = 0;
  private readonly budget: number;
  private readonly elevatedRatio: number;
  private readonly highRatio: number;
  private readonly criticalRatio: number;
  private readonly assetStore?: AssetStore;

  constructor(opts: MemoryGuardOptions = {}) {
    this.budget = opts.budget ?? DEFAULT_MEMORY_BUDGET;
    this.elevatedRatio = opts.elevatedRatio ?? 0.6;
    this.highRatio = opts.highRatio ?? 0.8;
    this.criticalRatio = opts.criticalRatio ?? 0.95;
    this.assetStore = opts.assetStore;

    // 阈值单调性校验,避免配置错误导致 pressure 永远卡在某一档
    if (!(this.elevatedRatio <= this.highRatio && this.highRatio <= this.criticalRatio)) {
      throw new Error(
        `MemoryGuard thresholds must be non-decreasing: ` +
          `elevated(${this.elevatedRatio}) <= high(${this.highRatio}) <= critical(${this.criticalRatio})`
      );
    }
  }

  /** 当前已登记的字节数 */
  get currentUsage(): number {
    return this.tracked;
  }

  /** 总预算(字节) */
  get budgetBytes(): number {
    return this.budget;
  }

  /** 当前是否已配置可溢出的 AssetStore */
  get canSpill(): boolean {
    return this.assetStore !== undefined;
  }

  /**
   * 登记一笔内存占用。返回 release 句柄,丢弃引用时调用以回退计数。
   * 用于追踪 decode 结果 / canvas 输出等大对象的生命周期。
   */
  track(bytes: number): MemoryAllocation {
    if (bytes < 0) {
      throw new Error(`MemoryGuard.track: bytes must be non-negative, got ${bytes}`);
    }
    this.tracked += bytes;
    let released = false;
    return {
      bytes,
      release: () => {
        if (released) return; // 幂等:重复 release 仅首次生效
        released = true;
        this.tracked = Math.max(0, this.tracked - bytes);
      },
    };
  }

  /** 当前压力等级(基于 tracked / budget) */
  getPressure(): MemoryPressure {
    const ratio = this.tracked / this.budget;
    if (ratio >= this.criticalRatio) return 'critical';
    if (ratio >= this.highRatio) return 'high';
    if (ratio >= this.elevatedRatio) return 'elevated';
    return 'low';
  }

  /** 已用比例(0-1+) */
  getUsageRatio(): number {
    return this.tracked / this.budget;
  }

  /**
   * 是否应溢出(pressure >= high)。无 assetStore 时永远 false(无法溢出,
   * 交由降级阶梯 L3/L4 处理)。
   */
  shouldSpill(): boolean {
    if (!this.assetStore) return false;
    const p = this.getPressure();
    return p === 'high' || p === 'critical';
  }

  /**
   * 把一个中间 Blob 溢出到 OPFS(assetStore.create),返回 Asset 句柄。
   * 调用方应在 spill 后丢弃内存中的 Blob 引用,以真正释放内存。
   *
   * @param blob 要溢出的中间结果
   * @param mimeType Blob 的 MIME(用于元数据);默认取 blob.type
   */
  async spill(blob: Blob, mimeType?: string): Promise<Asset> {
    if (!this.assetStore) {
      throw new Error(
        'MemoryGuard.spill requires an assetStore (OPFS-backed). ' +
          'Construct MemoryGuard with { assetStore } to enable spilling.'
      );
    }
    const mime = mimeType || blob.type || 'application/octet-stream';
    const metadata: AssetMetadata = {
      mimeType: mime,
      size: blob.size,
      format: mime.split('/')[1] ?? 'bin',
    };
    return this.assetStore.create(blob, metadata, 'image');
  }

  /** 从 OPFS 读回之前 spill 的中间结果 */
  async restore(asset: Asset): Promise<Blob> {
    if (!this.assetStore) {
      throw new Error('MemoryGuard.restore requires an assetStore');
    }
    return this.assetStore.getBlob(asset.blob);
  }

  /** 丢弃已 spill 的中间结果(处理完成后回收 OPFS 空间) */
  async evict(asset: Asset): Promise<void> {
    if (!this.assetStore) return;
    await this.assetStore.remove(asset.id);
  }

  /** 重置所有登记(用于工作流结束 / 取消后的清理,tracked 归零) */
  reset(): void {
    this.tracked = 0;
  }
}

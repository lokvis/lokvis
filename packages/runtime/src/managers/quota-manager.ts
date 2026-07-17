/**
 * Quota Manager
 *
 * 从 runtime.ts 抽取的存储配额管理逻辑(W2.9)。
 *
 * 职责:用配额校验包裹 AssetStore,import/create 超限时抛 QuotaExceededError,
 * 并维护运行中的已用字节数供 runtime.getStorageUsage O(1) 读取。
 *
 * 并发安全:import/create/remove 通过 promise 链串行化,避免 check 与 update
 * 之间的 TOCTOU 窗口导致两个并发操作都基于旧 usage 通过校验或回退。
 */

import type { AssetSource } from '@lokvis/schema';
import type { AssetStore } from '../asset-store.js';

/** 存储配额超限时抛出(W2.9) */
export class QuotaExceededError extends Error {
  readonly usage: number;
  readonly delta: number;
  readonly quota: number;
  constructor(usage: number, delta: number, quota: number) {
    super(
      `Storage quota exceeded: usage=${usage} + delta=${delta} > quota=${quota}`
    );
    this.name = 'QuotaExceededError';
    this.usage = usage;
    this.delta = delta;
    this.quota = quota;
  }
}

/**
 * 从 AssetSource 估算导入字节数用于配额预检。
 * url/opfs 源大小未知,返回 0 跳过预检 —— 真实大小在 import 完成后
 * 通过 `usage += asset.metadata.size` 补记到账面,后续操作仍受配额约束。
 */
export function estimateSourceSize(source: AssetSource): number {
  if (source.kind === 'file') return source.file.size;
  if (source.kind === 'blob') return source.blob.size;
  return 0;
}

/**
 * 配额感知的 AssetStore:在 AssetStore 接口之上扩展 _getQuotaUsage,
 * 供 runtime.getStorageUsage O(1) 读取内部 usage(下划线表"内部 API")。
 */
export type QuotaAwareAssetStore = AssetStore & {
  _getQuotaUsage: () => number;
};

/**
 * 用配额校验包裹 AssetStore:import/create 超限抛 QuotaExceededError(W2.9)。
 * 内部维护运行中的已用字节数,remove 时回退。
 *
 * 并发安全:import/create/remove 通过 promise 链串行化,避免 check 与 update
 * 之间的 TOCTOU 窗口导致两个并发操作都基于旧 usage 通过校验或回退。
 */
export function wrapAssetStoreWithQuota(
  inner: AssetStore,
  quota: number
): QuotaAwareAssetStore {
  let usage = 0;
  let initialized = false;
  /** 串行化 import/create/remove 的 chain tail,确保 check-update 原子性 */
  let chain: Promise<unknown> = Promise.resolve();

  async function ensureInit(): Promise<void> {
    if (initialized) return;
    const all = await inner.list();
    usage = all.reduce((sum, a) => sum + a.metadata.size, 0);
    initialized = true;
  }

  function assertQuota(delta: number): void {
    if (usage + delta > quota) {
      throw new QuotaExceededError(usage, delta, quota);
    }
  }

  /** 将 import/create/remove 串行化:依次 await init → assert → inner op → update usage */
  function runExclusive<T>(op: () => Promise<T>): Promise<T> {
    const run = chain.then(op, op);
    // chain 仅用于排队,不传播 rejection(避免一次失败阻塞后续)
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  return {
    async import(source) {
      return runExclusive(async () => {
        await ensureInit();
        assertQuota(estimateSourceSize(source));
        const asset = await inner.import(source);
        usage += asset.metadata.size;
        return asset;
      });
    },
    async get(id) {
      return inner.get(id);
    },
    async getBlob(handle) {
      return inner.getBlob(handle);
    },
    async remove(id) {
      return runExclusive(async () => {
        const existing = await inner.get(id);
        await inner.remove(id);
        if (existing) {
          usage = Math.max(0, usage - existing.metadata.size);
        }
      });
    },
    async list() {
      return inner.list();
    },
    async create(blob, metadata, type) {
      return runExclusive(async () => {
        await ensureInit();
        // m8 修复:配额预检与累加使用同一口径(metadata.size),
        // 避免 blob.size 与 metadata.size 漂移导致账面与预检不一致
        assertQuota(metadata.size);
        const asset = await inner.create(blob, metadata, type);
        usage += asset.metadata.size;
        return asset;
      });
    },
    /**
     * m6 优化:暴露配额包装器内部维护的 usage(O(1)),
     * 供 runtime.getStorageUsage 优先使用,避免每次 O(n) 全量 listAssets。
     * 下划线前缀表"内部 API",非 AssetStore 接口一部分。
     * 若 ensureInit 未完成,返回 -1 表示"未就绪",调用方 fallback 到 listAssets。
     */
    _getQuotaUsage(): number {
      return initialized ? usage : -1;
    },

    // W21.6: 透传 dispose 给 inner store,并重置内部 usage/initialized/chain,
    // 确保 dispose 后的 wrapper 状态一致(尽管不建议 dispose 后继续使用)。
    async dispose() {
      usage = 0;
      initialized = false;
      chain = Promise.resolve();
      await inner.dispose?.();
    },
  };
}

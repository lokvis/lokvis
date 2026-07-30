/**
 * 测试 fake(ADR-015)。
 *
 * 经 `@lokvis/browser-adapter/test-utils` 子路径导入,不进主入口。
 * 替代各包自行 vi.stubGlobal 浏览器 API 的做法(测试约定:浏览器 API
 * 用 fake)。存量测试不强制迁移,新测试优先用本模块。
 */

import type { KVStore, KVStoreOptions } from './kv-store.js';
import type { ImageDimensions } from './media-probe.js';
import { OpfsNotSupportedError } from './storage.js';

/** 内存版 KVStore(Map 后端,无 IndexedDB 依赖) */
export function createMemoryKVStore<T>(keyPath: string): KVStore<T> {
  const records = new Map<string, T>();
  const keyOf = (record: T) =>
    String((record as Record<string, unknown>)[keyPath]);

  return {
    async get(key) {
      return records.get(key);
    },
    async put(record) {
      records.set(keyOf(record), record);
    },
    async delete(key) {
      records.delete(key);
    },
    async toArray() {
      return Array.from(records.values());
    },
    async clear() {
      records.clear();
    },
    close() {
      // 内存版无连接可关;数据保留以便测试断言
    },
  };
}

/** createFakeAdapter 可编程结果 */
export interface FakeAdapterOverrides {
  /** 格式 → 是否支持(未指定的格式:png/jpeg true,其余 false) */
  encodeSupport?: Record<string, boolean>;
  /** probeImageDimensions 返回值(默认 undefined) */
  imageDimensions?: ImageDimensions;
  /** probeMediaDuration 返回值(默认 undefined) */
  mediaDuration?: number;
  /** getOpfsRoot 返回的根句柄(未指定则抛 OpfsNotSupportedError) */
  opfsRoot?: FileSystemDirectoryHandle;
}

/** 可编程的 fake adapter(探测/存储均无真实浏览器 API 依赖) */
export function createFakeAdapter(overrides: FakeAdapterOverrides = {}) {
  return {
    async detectEncodeSupport(
      formats: readonly string[]
    ): Promise<Record<string, boolean>> {
      const results: Record<string, boolean> = {};
      for (const fmt of formats) {
        results[fmt] =
          overrides.encodeSupport?.[fmt] ?? (fmt === 'png' || fmt === 'jpeg');
      }
      return results;
    },
    async probeImageDimensions(): Promise<ImageDimensions | undefined> {
      return overrides.imageDimensions;
    },
    async probeMediaDuration(): Promise<number | undefined> {
      return overrides.mediaDuration;
    },
    async getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
      if (!overrides.opfsRoot) throw new OpfsNotSupportedError();
      return overrides.opfsRoot;
    },
    createKVStore<T>(options: KVStoreOptions): KVStore<T> {
      return createMemoryKVStore<T>(options.keyPath);
    },
  };
}

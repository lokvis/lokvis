/**
 * 测试 fake(ADR-015)。
 *
 * 经 `@lokvis/browser-adapter/test-utils` 子路径导入,不进主入口。
 *
 * 使用约定(FO-28 决议):
 * - **createFakeAdapter**:被测代码通过依赖注入接收 adapter 实例时
 *   (如 engine 层测试、embed 层测试),用 createFakeAdapter 提供完整 fake。
 * - **vi.stubGlobal**:被测代码直接访问模块级全局 API 时
 *   (如 browser-detect 探测 navigator/OffscreenCanvas、adapter 内部
 *   probeImageDimensions 访问 createImageBitmap),stubGlobal 是正确做法,
 *   因为 createFakeAdapter 无法拦截模块级函数对全局的直接读取。
 */

import type { KVStore, KVStoreOptions } from './kv-store.js';
import type { ImageDimensions } from './media-probe.js';
import { OpfsNotSupportedError } from './storage.js';
import type {
  FilePickerAdapter,
  FilePickerOptions,
} from './file-picker.js';

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

/** createFakeFilePicker 可编程结果 */
export interface FakeFilePickerOverrides {
  /** pickFiles 返回值(默认空数组) */
  pickFilesResult?: File[];
  /** pickDirectory 返回值(默认空数组) */
  pickDirectoryResult?: File[];
  /** saveFile 返回值(默认 true) */
  saveFileResult?: boolean;
  /** isNativeSupported 返回值(默认 true) */
  nativeSupported?: boolean;
}

/** createFakeFilePicker 记录的调用历史(测试断言用) */
export interface FakeFilePickerCalls {
  pickFiles: (FilePickerOptions | undefined)[];
  pickDirectory: number;
  saveFile: { blob: Blob; suggestedName: string }[];
  downloadFile: { blob: Blob; filename: string }[];
}

/** 可编程的 fake FilePickerAdapter(无真实 DOM / File System Access 依赖) */
export function createFakeFilePicker(
  overrides: FakeFilePickerOverrides = {}
): FilePickerAdapter & { calls: FakeFilePickerCalls } {
  const calls: FakeFilePickerCalls = {
    pickFiles: [],
    pickDirectory: 0,
    saveFile: [],
    downloadFile: [],
  };
  return {
    calls,
    async pickFiles(options?: FilePickerOptions): Promise<File[]> {
      calls.pickFiles.push(options);
      return overrides.pickFilesResult ?? [];
    },
    async pickDirectory(): Promise<File[]> {
      calls.pickDirectory += 1;
      return overrides.pickDirectoryResult ?? [];
    },
    async saveFile(blob: Blob, suggestedName: string): Promise<boolean> {
      calls.saveFile.push({ blob, suggestedName });
      return overrides.saveFileResult ?? true;
    },
    downloadFile(blob: Blob, filename: string): void {
      calls.downloadFile.push({ blob, filename });
    },
    isNativeSupported(): boolean {
      return overrides.nativeSupported ?? true;
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
  /** file-picker fake 行为(默认空选择 / saveFile true / native true) */
  filePicker?: FakeFilePickerOverrides;
}

/** 可编程的 fake adapter(探测/存储/文件选择均无真实浏览器 API 依赖) */
export function createFakeAdapter(overrides: FakeAdapterOverrides = {}) {
  const filePicker = createFakeFilePicker(overrides.filePicker);
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
    filePicker,
  };
}

/**
 * StorageAdapter —— OPFS 原生入口封装(ADR-015)
 *
 * 收编 runtime 内两处 `navigator.storage.getDirectory()` 直接调用
 * (opfs-asset-store.ts / managers/asset-manager.ts)。
 *
 * 环境安全约定:OPFS 不可用时抛语义化 OpfsNotSupportedError
 * (而非 ReferenceError),调用方可据此走降级链。
 */

import { isOpfsSupported } from './env-probe.js';

/** OPFS 不可用时由 getOpfsRoot 抛出 */
export class OpfsNotSupportedError extends Error {
  constructor(
    message = 'OPFS is not available: navigator.storage.getDirectory is undefined'
  ) {
    super(message);
    this.name = 'OpfsNotSupportedError';
  }
}

/**
 * 获取 OPFS 根目录句柄。
 *
 * 全仓唯一允许出现 `navigator.storage.getDirectory()` 的调用点。
 */
export async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  if (!isOpfsSupported()) {
    throw new OpfsNotSupportedError();
  }
  return navigator.storage.getDirectory();
}

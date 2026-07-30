/**
 * MediaProbe —— 媒体富元数据提取(ADR-015)
 *
 * 自 runtime/src/asset-store.ts 的 extractImageDimensions /
 * extractMediaDuration 迁入(W6.4 / M2 超时兜底)。
 *
 * 环境安全约定:所需浏览器 API 缺失时返回 undefined(不抛
 * ReferenceError);解码失败等运行期错误向上抛出,由调用方决定
 * 降级策略(runtime 的 extractRichMetadata 捕获后 warn)。
 */

/** 图片尺寸 */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** 媒体时长提取超时(5s,足够解码大多数媒体头) */
const MEDIA_DURATION_TIMEOUT_MS = 5000;

/**
 * 用 createImageBitmap 提取图片尺寸。
 *
 * API 不可用(Node/SSR)返回 undefined;解码失败抛错。
 */
export async function probeImageDimensions(
  blob: Blob
): Promise<ImageDimensions | undefined> {
  if (typeof createImageBitmap !== 'function') return undefined;
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    // 释放 ImageBitmap 资源,避免内存泄漏(浏览器 GC 不保证立即回收)
    if (typeof bitmap.close === 'function') bitmap.close();
  }
}

/**
 * 用 HTMLMediaElement 提取视频/音频时长(秒)。
 *
 * document 不可用(Node/SSR)返回 undefined;元数据加载失败或
 * 5s 超时(坏文件既不触发 loadedmetadata 也不触发 onerror)同样
 * 返回 undefined,不会永久挂起。
 */
export async function probeMediaDuration(
  blob: Blob,
  type: 'video' | 'audio'
): Promise<number | undefined> {
  if (typeof document === 'undefined') return undefined;
  const url = URL.createObjectURL(blob);
  try {
    const el = document.createElement(type === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    el.src = url;
    return await new Promise<number | undefined>((resolve) => {
      let settled = false;
      const finish = (result: number | undefined) => {
        if (settled) return;
        settled = true;
        el.onloadedmetadata = null;
        el.onerror = null;
        el.removeAttribute('src');
        clearTimeout(timer);
        resolve(result);
      };
      el.onloadedmetadata = () => {
        const duration = el.duration;
        finish(Number.isFinite(duration) ? duration : undefined);
      };
      el.onerror = () => finish(undefined);
      // 超时兜底,防止坏文件导致 Promise 永久挂起 +
      // 外层 finally 的 revokeObjectURL 永不执行(泄漏)
      const timer = setTimeout(() => finish(undefined), MEDIA_DURATION_TIMEOUT_MS);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Video 文件信息与下载工具(@lokvis/embed-video 内部)。
 */

/** Video 文件元信息 */
export interface VideoFileInfo {
  /** 文件大小(bytes) */
  size: number;
  /** MIME 类型 */
  format: string;
  /** 时长(秒,解析失败时为 null) */
  duration: number | null;
}

/**
 * 获取 Video 文件基本信息。
 * 时长通过 <video> 元素 metadata 事件获取;失败时 duration=null。
 */
export async function getVideoFileInfo(blob: Blob): Promise<VideoFileInfo> {
  let duration: number | null = null;
  try {
    duration = await new Promise<number | null>((resolve) => {
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration || null);
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      video.src = url;
    });
  } catch {
    // 解析失败不阻塞
  }
  return {
    size: blob.size,
    format: blob.type || 'video/mp4',
    duration,
  };
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 格式化文件大小 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/** 格式化时长(秒 → mm:ss) */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

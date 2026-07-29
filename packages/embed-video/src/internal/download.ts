/**
 * Video 文件信息工具(@lokvis/embed-video 内部)。
 *
 * 仅承载视频专属元信息(VideoFileInfo / getVideoFileInfo / formatDuration)。
 * 通用下载 / 字节格式化分别属 @lokvis/embed-kit(downloadBlob)与
 * @lokvis/runtime(formatBytes),消费方直接从对应包导入,不在此中转。
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

/** 格式化时长(秒 → mm:ss) */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

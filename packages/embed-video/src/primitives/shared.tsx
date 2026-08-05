/**
 * Layer 1 共享工具(@lokvis/embed-video 内部)。
 */

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
const VIDEO_MIME_PREFIX = 'video/';

/** 检查文件是否为视频 */
export function fileMatchesVideo(file: File): boolean {
  if (file.type.startsWith(VIDEO_MIME_PREFIX)) return true;
  const name = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

// FO-40: DefaultPresetButton 已收敛到 @lokvis/embed-kit,此处 re-export 保持向后兼容
export { DefaultPresetButton } from '@lokvis/embed-kit';

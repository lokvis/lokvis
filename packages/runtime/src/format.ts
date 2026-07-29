/**
 * 通用格式化工具。
 *
 * 全仓唯一的 formatBytes 实现:此前 runtime / ui-react / embed-image /
 * embed-pdf / embed-video / playground 各自维护了行为不一致的副本(有无空格、
 * 是否支持 GB、小数位不同),极易 drift。统一收敛到 runtime(所有消费方均
 * 依赖 @lokvis/runtime),各消费方从此处再导出。
 */

/**
 * 字节数格式化为人类可读字符串(1024 进制,带空格)。
 *
 * - B:整数
 * - KB / MB:1 位小数
 * - GB:2 位小数
 * - 负数 / NaN / Infinity:归一为 `0 B`
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

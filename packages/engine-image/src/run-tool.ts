/**
 * runTool - 统一工具入口
 *
 * 按工具名路由到对应的图像处理函数,为单工具页(ToolPage)提供
 * 简洁的 Blob→Blob 调用接口,无需了解底层操作函数映射。
 *
 * @example
 * ```ts
 * import { runTool } from '@lokvis/engine-image';
 *
 * const output = await runTool('image.compress', inputBlob, {
 *   quality: 80,
 *   format: 'webp',
 * }, { onProgress: (p) => console.log(`${p}%`) });
 * ```
 */

import { compress } from './operations/encode.js';
import { resize, crop, rotate, flip } from './operations/transform.js';
import { convert } from './operations/encode.js';
import { watermark } from './operations/watermark.js';
import { filter } from './operations/filters.js';
import { setBackground } from './operations/encode.js';
import { compressToTargetSize } from './operations/compress-target.js';

type OperationFn = (
 blob: Blob,
 params: Record<string, any>,
 signal?: AbortSignal,
) => Promise<Blob>;

const TOOL_MAP: Record<string, OperationFn> = {
 'image.compress': compress,
 'image.resize': resize,
 'image.convert': convert,
 'image.crop': crop,
 'image.rotate': rotate,
 'image.flip': flip,
 'image.watermark': watermark,
 'image.filter': filter,
 'image.background': setBackground,
};

export interface RunToolOptions {
 signal?: AbortSignal;
 onProgress?: (progress: number) => void;
}

/**
 * 按工具名调用对应的图像处理函数。
 *
 * 支持的 toolName:
 * - image.compress / image.resize / image.convert / image.crop
 * - image.rotate / image.flip / image.watermark / image.filter
 * - image.background
 *
 * @throws Error 当 toolName 不在支持列表中时
 */
export async function runTool(
 toolName: string,
 input: Blob,
 params: Record<string, unknown>,
 options?: RunToolOptions,
): Promise<Blob> {
 const fn = TOOL_MAP[toolName];
 if (!fn) {
  throw new Error(
   `Unknown tool: ${toolName}. Supported: ${Object.keys(TOOL_MAP).join(', ')}`,
  );
 }

 options?.onProgress?.(0);
 const result = await fn(input, params as Record<string, any>, options?.signal);
 options?.onProgress?.(100);

 return result;
}

/** 返回所有已注册的工具名列表 */
export function listTools(): string[] {
 return Object.keys(TOOL_MAP);
}

/** 检查工具名是否已注册 */
export function hasTool(toolName: string): boolean {
 return toolName in TOOL_MAP;
}

/**
 * 按目标体积压缩(特殊路径,不走 TOOL_MAP)。
 *
 * compressToTargetSize 签名与其他操作不同(需要额外 size 参数),
 * 因此作为独立导出,不纳入 runTool 路由。
 */
export { compressToTargetSize };

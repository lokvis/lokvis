/**
 * 图像操作(聚合入口)
 *
 * 按操作类别拆分到独立文件,此处统一 re-export,
 * 外部导入路径 `@lokvis/engine-image` 保持不变。
 *
 * 当前已实现:
 * - transform.ts:       几何变换(resize / crop / rotate / flip)
 * - encode.ts:          编码与格式(compress / convert / setBackground)
 * - watermark.ts:       水印(文字 / 图片)
 * - compress-target.ts: 目标体积压缩(二分查找)
 * - png-metadata.ts:    PNG 物理分辨率(DPI)嵌入 / 读取 pHYs chunk(W8.4)
 * - utils.ts:           共享工具(inferFormat / computeTargetSize / throwIfAborted)
 * - tiles.ts:           大图分片(splitIntoTiles / mergeChunks / isDownscale)(W3.2)
 *
 * 预留位(W7 实现时填入):
 * - filters.ts:         简单滤镜(黑白/棕褐/模糊)
 *
 * 注:EXIF 元数据读取未放本层 —— readExif 是 Blob→ExifData 查询,不符合
 * AGENTS.md 规定的 Engine 层 Blob↔Blob 纯函数约束。实现位于 Capability 层
 * (plugin-image/src/exif-reader.ts),通过 MetadataReader 机制注册给 Runtime。
 */
import type { DecodedImage } from '../types.js';
import { canvasEngine } from '../canvas-engine.js';

export * from './utils.js';
export * from './transform.js';
export * from './encode.js';
export * from './watermark.js';
export * from './filters.js';
export * from './compress-target.js';
export * from './tiles.js';
export * from './png-metadata.js';

/** 解码图像元数据（不保留 bitmap） */
export async function probe(blob: Blob): Promise<DecodedImage> {
  return canvasEngine.decode(blob);
}

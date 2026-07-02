/**
 * 大图分片(tiling)工具(W3.2)
 *
 * Canvas 引擎无法像 WASM 编解码器那样逐行流式处理——`createImageBitmap`
 * 一旦调用就全量解码整张图到内存。但分片仍有两层价值:
 *
 * 1. 内存峰值控制:对超大图,把"绘制 + 编码"阶段按 tile 切分,
 *    内存里同时只持有一个 tile 的 canvas + bitmap(而非整张输出 canvas)。
 *    decode 峰值无法消除,但输出阶段的峰值可降到单 tile 级。
 * 2. 流水线溢出:每个 tile 编码后可立即溢出到 OPFS(W3.3 memory-guard),
 *    下游节点按需 restore,实现"OPFS 当虚拟内存"。
 *
 * 配套:
 * - splitIntoTiles(width, height, tileSize):把图切成网格(纯函数)。
 * - mergeChunks(chunks, totalW, totalH, format, quality):把分片编码
 *   结果合回单张 Blob(供 StreamingImageEngineAdapter.mergeChunks 契约)。
 *
 * 另:resize 操作在大图缩小时,改用 createImageBitmap 的 resize 选项
 * 直接解码到目标尺寸(见 transform.ts),避免持有全分辨率 bitmap——
 * 这是 canvas 引擎最大的单点内存优化。
 */

import type { ImageChunk, ImageTile, ImageOutputFormat } from '../types.js';
import { canvasEngine, createCanvas, get2DContext } from '../canvas-engine.js';

/** 默认 tile 边长(像素)。512² ≈ 1MB RGBA,单 tile 内存开销可控 */
export const DEFAULT_TILE_SIZE = 512;

/**
 * 把 (width × height) 的图切成 tile 网格。
 *
 * tile 按行优先排列,边缘 tile 可能小于 tileSize(对齐到图边界)。
 * 返回空数组的边界情况:width/height <= 0 或 tileSize <= 0。
 */
export function splitIntoTiles(
  width: number,
  height: number,
  tileSize: number = DEFAULT_TILE_SIZE
): ImageTile[] {
  if (width <= 0 || height <= 0 || tileSize <= 0) return [];
  const tiles: ImageTile[] = [];
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      tiles.push({
        x,
        y,
        width: Math.min(tileSize, width - x),
        height: Math.min(tileSize, height - y),
      });
    }
  }
  return tiles;
}

/**
 * 把已编码的分片(chunk)合回单张 Blob。
 *
 * 实现:decode 每个 chunk 的 blob → drawImage 到 (totalW × totalH) 的
 * 输出 canvas 的对应 tile 位置 → 整张 encode。
 *
 * 内存:合并阶段需同时持有输出 canvas 与当前 chunk 的 bitmap(单 tile 级),
 * 输出 canvas 大小为 totalW × totalH(与原图等大)。
 *
 * @param chunks 分片编码结果(每个含 tile 位置 + blob)
 * @param totalWidth 输出图总宽
 * @param totalHeight 输出图总高
 * @param format 输出格式
 * @param quality 质量(0-100),仅对有损格式生效
 */
export async function mergeChunks(
  chunks: ImageChunk[],
  totalWidth: number,
  totalHeight: number,
  format: ImageOutputFormat,
  quality: number = 95
): Promise<Blob> {
  if (chunks.length === 0) {
    throw new Error('mergeChunks: no chunks provided');
  }
  if (totalWidth <= 0 || totalHeight <= 0) {
    throw new Error(`mergeChunks: invalid total dimensions ${totalWidth}x${totalHeight}`);
  }

  const canvas = createCanvas(totalWidth, totalHeight);
  const ctx = get2DContext(canvas);

  for (const chunk of chunks) {
    const { bitmap } = await canvasEngine.decode(chunk.blob);
    ctx.drawImage(bitmap, chunk.tile.x, chunk.tile.y, chunk.tile.width, chunk.tile.height);
    bitmap.close?.();
  }

  return canvasEngine.encode(canvas, format, quality);
}

/**
 * 判断给定的源/目标尺寸是否为"缩小"(target < source)。
 * 用于决定 resize 是否走 createImageBitmap resize 选项路径(避免全分辨率 decode)。
 */
export function isDownscale(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number
): boolean {
  // 任一目标边小于源边即视为缩小(面积更小)
  return targetW < srcW || targetH < srcH;
}

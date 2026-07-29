/**
 * 大图分片(tiling)工具(W3.2 / W21.5)
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
 * - processLargeImageWithTiles(W21.5):高阶函数,对 >LARGE_IMAGE_THRESHOLD
 *   的图自动走 tile 路径,每个 tile 单独 draw+encode 后合并。
 *
 * 另:resize 操作在大图缩小时,改用 createImageBitmap 的 resize 选项
 * 直接解码到目标尺寸(见 transform.ts),避免持有全分辨率 bitmap——
 * 这是 canvas 引擎最大的单点内存优化。
 */

import type { ImageChunk, ImageTile, ImageOutputFormat } from '../types.js';
import { decodeImage, createCanvas, get2DContext } from '../canvas-engine.js';
import { throwIfAborted } from './utils.js';
import { encodeSmart } from './wasm-encode.js';

/** 默认 tile 边长(像素)。512² ≈ 1MB RGBA,单 tile 内存开销可控 */
export const DEFAULT_TILE_SIZE = 512;

/**
 * 大图阈值(W21.5):任一维超过此值即视为"大图",走 tile-based 路径。
 *
 * 4096 的依据:
 * - 4K 图(3840×2160)是常见相机的单张产出,UA 需稳定处理
 * - 4096² × 4(RGBA)= 64MB,在主流设备内存预算内(<256MB 单帧)
 * - 超过此值时整张 drawImage + encode 的内存峰值会快速上涨(8K=512MB),
 *   tile 切分收益开始显著
 * - 与 WebGL `MAX_TEXTURE_SIZE` 的常见下限(4096)对齐,便于未来接入
 *   WebCodecs / WebGL 加速路径时复用同一阈值
 */
export const LARGE_IMAGE_THRESHOLD = 4096;

/**
 * 判断图像是否应走 tile-based 路径(W21.5)。
 *
 * 任一维超过 LARGE_IMAGE_THRESHOLD 即返回 true。供 compress / convert /
 * setBackground 等操作在 decode 后决定走单 canvas 还是 tile 分片路径。
 */
export function shouldUseTiles(width: number, height: number): boolean {
  return width > LARGE_IMAGE_THRESHOLD || height > LARGE_IMAGE_THRESHOLD;
}

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
 * @param signal 可选取消信号;每个 chunk decode 前检查(W3.5)
 */
export async function mergeChunks(
  chunks: ImageChunk[],
  totalWidth: number,
  totalHeight: number,
  format: ImageOutputFormat,
  quality: number = 95,
  signal?: AbortSignal
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
    throwIfAborted(signal);
    const { bitmap } = await decodeImage(chunk.blob);
    // W21.6: 每个 chunk 的 bitmap 用 try/finally 释放,确保 throwIfAborted
    // 在下一次循环前抛错时当前 bitmap 不泄漏
    try {
      ctx.drawImage(bitmap, chunk.tile.x, chunk.tile.y, chunk.tile.width, chunk.tile.height);
    } finally {
      bitmap.close?.();
    }
  }

  return encodeSmart(canvas, format, quality, signal);
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

// ─── W21.5: 大图 tile-based 处理高阶函数 ─────────────────────────
//
// 设计:把"对每个 tile 绘制 + 编码"作为回调注入,使 compress/convert/
// setBackground 等操作能复用同一分片框架,各自只关心"如何在 canvas 上
// 绘制一个 tile"。
//
// 内存收益(以 8192×8192 RGBA 为例):
// - 单 canvas 路径:输出 canvas 8192²×4 = 256MB + 源 bitmap 256MB = 512MB 峰值
// - tile 路径(512²):输出 canvas 256MB(最终 encode 时) + 单 tile 1MB = ~257MB
//   注:mergeChunks 仍需整张输出 canvas,但绘制阶段峰值降到单 tile 级。
//   未来可改为逐 tile 编码后直接流式写入 OPFS,完全消除整张输出 canvas。

/**
 * 每个 tile 的绘制回调:在已准备好的 canvas context 上绘制源 bitmap 的
 * 指定区域到 tile 对应的位置。
 *
 * 回调约定:
 * - ctx 已 apply 完必要状态(fillStyle / fillRect 背景等)
 * - bitmap 是源图(全分辨率),回调负责 drawImage 的源/目标坐标计算
 * - 不负责 encode,encode 由 processLargeImageWithTiles 统一执行
 */
export type TileDrawCallback = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  tile: ImageTile
) => void;

/**
 * 对大图按 tile 分片处理:每个 tile 单独 draw + encode,最后合并。
 *
 * 流程:
 * 1. 把 (width × height) 切成 tileSize 的网格
 * 2. 对每个 tile:创建 tile 大小的 canvas → 调 drawCb 绘制 → encode
 * 3. 把所有 chunk 合并回 (width × height) 的单张 Blob
 *
 * 内存:绘制阶段同时只持有 1 个 tile canvas(tileSize²×4 字节)+ 源 bitmap;
 * 合并阶段需要整张输出 canvas(width×height×4 字节),由 mergeChunks 创建。
 *
 * @param bitmap 源图位图(全分辨率,由调用方负责 close)
 * @param width 输出图总宽
 * @param height 输出图总高
 * @param format 输出格式
 * @param quality 质量(0-100)
 * @param drawCb 每个 tile 的绘制回调
 * @param signal 可选取消信号;每个 tile 开始前检查(W3.5)
 * @param tileSize tile 边长,默认 DEFAULT_TILE_SIZE
 */
export async function processLargeImageWithTiles(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  format: ImageOutputFormat,
  quality: number,
  drawCb: TileDrawCallback,
  signal?: AbortSignal,
  tileSize: number = DEFAULT_TILE_SIZE
): Promise<Blob> {
  if (width <= 0 || height <= 0) {
    throw new Error(`processLargeImageWithTiles: invalid dimensions ${width}x${height}`);
  }
  const tiles = splitIntoTiles(width, height, tileSize);
  if (tiles.length === 0) {
    throw new Error('processLargeImageWithTiles: no tiles generated');
  }

  const chunks: ImageChunk[] = [];
  for (const tile of tiles) {
    throwIfAborted(signal);
    const canvas = createCanvas(tile.width, tile.height);
    const ctx = get2DContext(canvas);
    drawCb(ctx, bitmap, tile);
    const blob = await encodeSmart(canvas, format, quality, signal);
    chunks.push({ tile, blob });
  }

  return mergeChunks(chunks, width, height, format, quality, signal);
}

/**
 * 几何变换操作(Node 引擎):rotate / flip
 *
 * 基于 sharp 的 rotate / flip / flop API 实现,
 * 与浏览器版 operations/transform.ts 同名操作对齐。
 *
 * 类型复用自 ../../types.js(问题 B:消除 engine-image-node 双源维护)。
 */
import type { FlipParams, RotateParams } from '../../types.js';
import {
  blobToBuffer,
  inferFormat,
  sharpToBlob,
  throwIfAborted,
  toSharpFormat,
} from './utils.js';

/**
 * Rotate:旋转图像。
 *
 * 与浏览器版 rotate 对齐:
 * - 接受 { angle, background }
 * - angle 归一化到 0-360(取模)
 * - 90/270 度时宽高互换
 * - background 填充旋转产生的空白区域(默认白色)
 *
 * sharp 的 .rotate(angle) 支持任意角度旋转,
 * 对于 90/180/270 等直角旋转效率极高(无损)。
 */
export async function rotate(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { angle: rawAngle, background } = params as RotateParams;
  if (typeof rawAngle !== 'number' || !Number.isFinite(rawAngle)) {
    throw new Error('rotate requires a numeric "angle" param (degrees)');
  }

  // 归一化到 [0, 360)
  const angle = ((rawAngle % 360) + 360) % 360;

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  // 解析背景色:默认白色(与浏览器版一致)
  const bg = background ?? '#ffffff';

  // sharp .rotate(angle, { background }) 支持任意角度
  // 对于 0 度无需操作
  let pipeline = sharp(srcBuffer, { failOn: 'none' });
  if (angle !== 0) {
    pipeline = pipeline.rotate(angle, { background: bg });
  }

  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return sharpToBlob(pipeline, toSharpFormat(format), 95);
}

/**
 * Flip:翻转图像。
 *
 * 与浏览器版 flip 对齐:
 * - axis='horizontal':水平翻转(左右镜像)→ sharp .flop()
 * - axis='vertical':垂直翻转(上下镜像)→ sharp .flip()
 * - axis='both':同时水平+垂直翻转 → .flip().flop()
 *
 * 注意 sharp 的命名与直觉相反:
 * - sharp.flip() = 垂直翻转(沿水平轴翻转,上下颠倒)
 * - sharp.flop() = 水平翻转(沿垂直轴翻转,左右镜像)
 */
export async function flip(
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
): Promise<Blob> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const { axis } = params as FlipParams;
  if (!axis || !['horizontal', 'vertical', 'both'].includes(axis)) {
    throw new Error(
      'flip requires an "axis" param: "horizontal" | "vertical" | "both"'
    );
  }

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  let pipeline = sharp(srcBuffer, { failOn: 'none' });

  // sharp.flip() = vertical flip (top-bottom)
  // sharp.flop() = horizontal flip (left-right)
  if (axis === 'vertical' || axis === 'both') {
    pipeline = pipeline.flip();
  }
  if (axis === 'horizontal' || axis === 'both') {
    pipeline = pipeline.flop();
  }

  throwIfAborted(signal);
  const format = inferFormat(blob, 'png');
  return sharpToBlob(pipeline, toSharpFormat(format), 95);
}

/**
 * 图像引擎类型定义
 *
 * EngineAdapter 协议见 whitepaper 04 §6.1。
 * 所有图像操作接收 Blob 输入，返回 Blob 输出（解码 → 处理 → 编码）。
 */

import type { AssetType } from '@lokvis/schema';

/** 引擎名标识 */
export type ImageEngineName = 'canvas' | 'squoosh' | 'webcodecs' | 'imagemagick';

/** 支持的输出格式 */
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'gif';

/** 调整尺寸适配策略 */
export type FitStrategy = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/** 翻转轴 */
export type FlipAxis = 'horizontal' | 'vertical' | 'both';

/** 水印位置 */
export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'tile';

/** Resize 参数 */
export interface ResizeParams {
  width?: number;
  height?: number;
  fit?: FitStrategy;
  maintainAspectRatio?: boolean;
}

/** 压缩参数 */
export interface CompressParams {
  format?: ImageOutputFormat;
  quality?: number; // 0-100
  targetSize?: number; // bytes
}

/** 转换格式参数 */
export interface ConvertParams {
  format: ImageOutputFormat;
  quality?: number;
}

/** 裁剪参数 */
export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 旋转参数 */
export interface RotateParams {
  angle: number; // degrees
  background?: string;
}

/** 翻转参数 */
export interface FlipParams {
  axis: FlipAxis;
}

/** 水印参数 */
export interface WatermarkParams {
  text?: string;
  image?: string; // data URL
  position?: WatermarkPosition;
  opacity?: number; // 0-1
  fontSize?: number;
  color?: string;
}

/** 背景参数 */
export interface BackgroundParams {
  color: string;
}

/** 解码后的位图与元数据 */
export interface DecodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** 引擎适配器接口（与 whitepaper §6.1 EngineAdapter 对齐） */
export interface ImageEngineAdapter {
  name: ImageEngineName;
  version: string;
  supportedCapabilities: string[];
  isSupported(): Promise<boolean>;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;

  // 基础操作
  decode(blob: Blob): Promise<DecodedImage>;
  encode(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    format: ImageOutputFormat,
    quality?: number
  ): Promise<Blob>;
}

/** 引擎能力检测：当前浏览器支持哪些图像格式编码 */
export interface FormatSupport {
  png: boolean;
  jpeg: boolean;
  webp: boolean;
  avif: boolean;
  gif: boolean;
}

/** 资产类型别名（避免直接 import AssetType 的循环依赖） */
export type { AssetType };

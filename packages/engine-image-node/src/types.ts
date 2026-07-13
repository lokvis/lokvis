/**
 * Node.js 图像引擎类型定义
 *
 * 与 @lokvis/engine-image(types.ts)对齐的类型:
 * - ImageOutputFormat / FitStrategy / WatermarkPosition 等纯类型可直接复用
 * - 参数接口(ResizeParams / CompressParams 等)与浏览器版字段保持一致,
 *   使 plugin-image 在 Node 环境下可无缝替换操作函数
 *
 * 不导出 ImageEngineAdapter / DecodedImage:
 * - ImageEngineAdapter.decode 返回 ImageBitmap(浏览器 API),Node 无此类型
 * - ImageEngineAdapter.encode 接受 HTMLCanvasElement | OffscreenCanvas,Node 无此类型
 * Node 引擎以"操作函数集"形式暴露能力,而非 EngineAdapter 实例。
 */

/** 支持的输出格式(与 engine-image 对齐) */
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'gif';

/** 调整尺寸适配策略(与 engine-image 对齐,sharp 0.33 支持 cover/contain/fill/inside/outside) */
export type FitStrategy = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/** 水印位置(与 engine-image 对齐) */
export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'tile';

/** Resize 参数(字段与 engine-image ResizeParams 对齐,不含 dpi:Node 引擎暂不嵌入 PNG pHYs) */
export interface ResizeParams {
  width?: number;
  height?: number;
  fit?: FitStrategy;
  maintainAspectRatio?: boolean;
}

/** 压缩参数(与 engine-image CompressParams 对齐,targetSize 由上层二分查找实现,本引擎不内置) */
export interface CompressParams {
  format?: ImageOutputFormat;
  quality?: number; // 1-100
  targetSize?: number; // bytes(本引擎暂不内置,留给上层)
}

/** 转换格式参数(与 engine-image ConvertParams 对齐) */
export interface ConvertParams {
  format: ImageOutputFormat;
  quality?: number;
}

/** 裁剪参数(与 engine-image CropParams 对齐) */
export interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 水印参数(与 engine-image WatermarkParams 对齐,imageUrl 走 SSRF 校验同 engine-image) */
export interface WatermarkParams {
  text?: string;
  image?: string; // data URL 或 http(s) URL
  position?: WatermarkPosition;
  opacity?: number; // 0-1
  fontSize?: number;
  color?: string;
}

/**
 * Node 引擎描述符(供 plugin-image 检测 stub 与命名)。
 *
 * 不实现 ImageEngineAdapter(decode/encode 与浏览器 API 耦合),
 * 只暴露元数据 + supportedCapabilities,供 plugin-image 在 Node 环境
 * 选择操作函数集时引用。
 */
export interface NodeImageEngineDescriptor {
  /** 引擎名,固定 'sharp' */
  name: 'sharp';
  /** 版本号,含 'stub' 时 plugin-image 视为占位实现 */
  version: string;
  /** 支持的能力列表 */
  supportedCapabilities: string[];
  /** 是否可用(sharp 加载成功) */
  isSupported(): Promise<boolean>;
}

/**
 * 操作函数签名(与 engine-image 操作函数完全一致)。
 *
 * AGENTS.md 约定:Engine 层操作函数统一接受 Record<string, any> 作为参数类型,
 * 上游无需类型断言。
 */
export type BlobOperation = (
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
) => Promise<Blob>;

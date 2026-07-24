/**
 * 图像引擎类型定义
 *
 * EngineAdapter 协议见 whitepaper 04 §6.1。
 * 所有图像操作接收 Blob 输入，返回 Blob 输出（解码 → 处理 → 编码）。
 */

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
  /**
   * 物理分辨率(每英寸像素数)。仅对 PNG 输出生效:嵌入 pHYs chunk,
   * 供打印软件读取(W8.4)。非正数或非 PNG 输出时忽略。
   */
  dpi?: number;
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
  /**
   * 水印图片来源(data URL 或 http(s) URL)。
   * 浏览器版仅接受 data URL(避免跨域/CORS);Node 端(@lokvis/engine-image/node)
   * 接受 http(s) URL 并做 SSRF 校验。统一为 string(不约束协议,问题 B)。
   */
  image?: string;
  position?: WatermarkPosition;
  opacity?: number; // 0-1
  fontSize?: number;
  color?: string;
}

/** 背景参数 */
export interface BackgroundParams {
  color: string;
}

/** 滤镜预设名 */
export type FilterPreset = 'grayscale' | 'invert' | 'sepia' | 'blur';

/** 滤镜参数 */
export interface FilterParams {
  preset: FilterPreset;
  /** blur 专用：模糊半径(px) */
  radius?: number;
}

/** ICO favicon 编码参数 */
export interface EncodeIcoParams {
  /** 目标尺寸列表(正方形边长 px),默认 [16, 32, 48, 256] */
  sizes?: number[];
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

// ─── Streaming 接口规范(W3.1)────────────────────────────────────
//
// Canvas 引擎无法像 WASM 编解码器那样逐行流式处理(createImageBitmap
// 全量解码),但大型图片(>500MB)需分片(tiling)处理以控制内存。
// 以下类型定义了流式操作的契约,供未来 WASM 引擎实现;
// canvas 引擎在 W3.2 通过 tile + createImageBitmap resize 选项近似实现。

/**
 * 图像分片(tile):大图按网格切分后的子区域。
 * 用于 tile-based 处理,避免一次性把整张图解码到内存。
 */
export interface ImageTile {
  /** 源图中的 x 偏移(像素) */
  x: number;
  /** 源图中的 y 偏移(像素) */
  y: number;
  /** tile 宽度(像素) */
  width: number;
  /** tile 高度(像素) */
  height: number;
}

/**
 * 流式操作结果:产出一系列 Blob 分片(chunk),最后合并。
 * 每个 chunk 携带其在输出图中的位置信息。
 */
export interface ImageChunk {
  /** 该 chunk 在输出图中的 tile 区域 */
  tile: ImageTile;
  /** 该区域的编码 Blob */
  blob: Blob;
}

/**
 * 流式图像操作接口(供未来 WASM / WebCodecs 引擎实现)。
 *
 * 约定:输入是一个 ReadableStream<Blob>(每个 Blob 是一个 tile 的编码数据),
 * 输出是 AsyncIterable<ImageChunk>(处理后的分片)。
 * 主线程可边接收边拼合,无需等待整张图处理完毕。
 *
 * canvas 引擎因 API 限制无法真正流式,改用 tile-based 同步处理近似。
 */
export interface StreamingImageOperation {
  (
    input: ReadableStream<Blob>,
    params: Record<string, unknown>,
    signal?: AbortSignal
  ): AsyncIterable<ImageChunk>;
}

/**
 * 流式引擎适配器:在 ImageEngineAdapter 基础上,
 * 额外支持按 tile 解码/编码(供 W3.2 tile-based 处理使用)。
 */
export interface StreamingImageEngineAdapter extends ImageEngineAdapter {
  /** 按区域解码(仅解码指定 tile,而非整张图) */
  decodeRegion?(blob: Blob, tile: ImageTile): Promise<DecodedImage>;
  /** 将多个 chunk 合并为单个 Blob(编码拼合) */
  mergeChunks?(
    chunks: ImageChunk[],
    totalWidth: number,
    totalHeight: number,
    format: ImageOutputFormat,
    quality?: number
  ): Promise<Blob>;
}

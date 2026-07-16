/**
 * Node 引擎专属类型
 *
 * 通用类型(ImageOutputFormat / FitStrategy / WatermarkPosition /
 * ResizeParams / CompressParams / ConvertParams / CropParams /
 * WatermarkParams)已统一在 ../types.js,Node 端直接复用,
 * 消除原 engine-image-node 包的双源维护(问题 B)。
 *
 * 唯一保留在 Node 子路径的:NodeImageEngineDescriptor —
 * Node 引擎不实现 ImageEngineAdapter(decode/encode 与浏览器 API
 * ImageBitmap / HTMLCanvasElement 耦合),只暴露元数据 +
 * supportedCapabilities,供 plugin-image 在 Node 环境选择操作函数集时引用。
 */

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

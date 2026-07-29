/**
 * 跨层共享的资产元数据查询类型。
 *
 * 与 ExifData 同一设计层级:某些 Plugin 能力本质是"元数据查询"而非
 * "资产变换"(如 image dimensions 读取、pdf 页数读取),既不符合 Engine
 * 层 Blob↔Blob 纯函数约束,也不符合 Capability Asset[]→Asset[] 契约。
 * 这类能力通过 MetadataReader 注册,返回值类型定义在此处,
 * 供 Runtime / SDK / 上层消费者(mcp-server 等)共享,避免跨层依赖。
 *
 * 与 AssetMetadata 的区别:
 * - AssetMetadata:导入时一次性提取的通用元数据(size/mimeType/format/
 *   dimensions/duration/pages),所有 asset 都有
 * - ImageMetadata / PdfInfo:按需查询的领域特定元数据,由 Plugin 通过
 *   MetadataReader 提供(如 image 经 sharp 解码读尺寸、pdf 经 pdf-lib
 *   读页数),用于处理后输出资产的精确元数据报告
 */

/**
 * 图像元数据(width/height/format)。
 *
 * 由 plugin-image 的 `image.read-metadata` MetadataReader 提供,
 * 内部调用 engine-image/node 的 getMetadata(sharp .metadata())。
 * 与 engine-image/node 的 ImageMetadata 接口对齐(此处为共享类型源,
 * engine-image 改为 re-export 本类型)。
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

/**
 * PDF 基本信息(页数)。
 *
 * 由 plugin-pdf 的 `pdf.read-info` MetadataReader 提供,
 * 内部调用 engine-pdf 的 getPdfInfo(pdf-lib getPageCount)。
 * 与 engine-pdf 的 PdfInfo 接口对齐(此处为共享类型源,
 * engine-pdf 改为 re-export 本类型)。
 */
export interface PdfInfo {
  pages: number;
}

/**
 * 视频基本信息(分辨率/时长/帧率/编解码)。
 *
 * 由 plugin-video/node 的 `video.read-info` MetadataReader 提供,
 * 内部调用 engine-video/node 的 getVideoInfo(ffprobe 解析)。
 * 与 engine-video 的 VideoInfo 接口对齐(此处为共享类型源,
 * engine-video 改为 re-export 本类型)。
 */
export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
}

/**
 * MetadataReader 名称常量(跨层单一事实源)。
 *
 * Plugin 通过 ctx.registerMetadataReader(name, fn) 注册,Runtime 按名查表调用。
 * 名称此前散落在 runtime(asset-manager 硬编码字符串)与各 plugin(各自定义
 * EXIF_READER_NAME 等常量),存在漂移风险。收敛到 schema 层后:
 * - Runtime asset-manager 直接引用本常量
 * - 各 plugin 的导出常量(EXIF_READER_NAME 等)改为 re-export 本常量的字段
 */
export const METADATA_READER_NAMES = {
  imageExif: 'image.read-exif',
  imageMetadata: 'image.read-metadata',
  pdfInfo: 'pdf.read-info',
  videoInfo: 'video.read-info',
} as const;

/** MetadataReader 名称联合类型(由 METADATA_READER_NAMES 派生) */
export type MetadataReaderName =
  (typeof METADATA_READER_NAMES)[keyof typeof METADATA_READER_NAMES];

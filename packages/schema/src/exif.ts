/**
 * EXIF 元数据类型(W7.3/7.4)
 *
 * 类型分两层:
 * - `ExifData`:面向 UI / Runtime 的公共类型,只含结构化字段,**无 raw**
 * - `RawExifData`:Plugin 内部类型,extends ExifData,额外含 `raw`(exifr 原始解析对象)
 *
 * 拆分原因(长期方案):UI 缓存 ExifData 时无需手动剔除 raw 字段,
 * 避免每个消费者都要做 `{...data, raw: undefined}` 的 patch 操作。
 * Plugin 在返回前把 RawExifData 收窄为 ExifData(丢弃 raw)。
 *
 * 注:EXIF 行格式化函数(formatExifRows)属 UI 展示逻辑,归位于 @lokvis/ui-react,
 * 不放 schema 层(schema 只承载类型与业务约束常量)。
 */

/**
 * 面向 UI / Runtime 的 EXIF 结构化数据。
 * 不含 raw 字段 —— raw 仅在 Plugin 内部用于调试 / 高级展示,
 * 不会传递到 UI 层(避免大对象在缓存中累积)。
 */
export interface ExifData {
  make?: string;
  model?: string;
  lensModel?: string;
  dateTimeOriginal?: string;
  iso?: number;
  fNumber?: number;
  exposureTime?: number;
  focalLength?: number;
  exposureCompensation?: number;
  whiteBalance?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  orientation?: number;
  software?: string;
}

/**
 * Plugin 内部使用的完整 EXIF 数据,extends ExifData 并附加 raw 字段。
 * raw 保留 exifr.parse 返回的原始对象,供调试或未来高级面板使用。
 * Plugin 在通过 MetadataReader 返回给 Runtime 时,应丢弃 raw(收窄为 ExifData)。
 */
export interface RawExifData extends ExifData {
  /** exifr.parse 返回的原始对象(未筛选) */
  raw?: Record<string, unknown>;
}

/** EXIF 面板的单行展示数据 */
export interface ExifRow {
  label: string;
  value: string;
}

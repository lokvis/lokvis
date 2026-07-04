/**
 * EXIF 元数据类型与格式化(W7.3/7.4)
 *
 * 类型分两层:
 * - `ExifData`:面向 UI / Runtime 的公共类型,只含结构化字段,**无 raw**
 * - `RawExifData`:Plugin 内部类型,extends ExifData,额外含 `raw`(exifr 原始解析对象)
 *
 * 拆分原因(长期方案):UI 缓存 ExifData 时无需手动剔除 raw 字段,
 * 避免每个消费者都要做 `{...data, raw: undefined}` 的 patch 操作。
 * Plugin 在返回前把 RawExifData 收窄为 ExifData(丢弃 raw)。
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

/**
 * 把 ExifData 格式化为 UI 展示用的行列表。
 * 纯函数,放 schema 层供 UI 直接调用,避免 UI 跨层依赖 plugin / engine。
 */
export function formatExifRows(exif: ExifData): ExifRow[] {
  const rows: ExifRow[] = [];
  const push = (label: string, value: string | undefined): void => {
    if (value !== undefined && value !== '') rows.push({ label, value });
  };
  push('Camera', exif.make && exif.model ? `${exif.make} ${exif.model}` : exif.make ?? exif.model);
  push('Lens', exif.lensModel);
  push('Date', exif.dateTimeOriginal);
  push('ISO', exif.iso !== undefined ? `ISO ${exif.iso}` : undefined);
  push('Aperture', exif.fNumber !== undefined ? `f/${exif.fNumber}` : undefined);
  push('Shutter', exif.exposureTime !== undefined ? formatShutterSpeed(exif.exposureTime) : undefined);
  push('Focal Length', exif.focalLength !== undefined ? `${exif.focalLength}mm` : undefined);
  push('Exposure Comp.', exif.exposureCompensation !== undefined ? `${exif.exposureCompensation} EV` : undefined);
  push('White Balance', exif.whiteBalance);
  push('Software', exif.software);
  if (exif.gpsLatitude !== undefined && exif.gpsLongitude !== undefined) {
    push('GPS', `${exif.gpsLatitude.toFixed(6)}, ${exif.gpsLongitude.toFixed(6)}`);
    if (exif.gpsAltitude !== undefined) {
      push('GPS Altitude', `${exif.gpsAltitude.toFixed(1)} m`);
    }
  }
  push('Orientation', exif.orientation !== undefined ? `${exif.orientation}` : undefined);
  return rows;
}

/**
 * 格式化快门速度:
 * - >= 1s 直接显示秒数(如 "2s")
 * - < 1s 转为分数(如 1/250s)
 */
function formatShutterSpeed(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`;
  const denominator = Math.round(1 / seconds);
  return `1/${denominator}s`;
}

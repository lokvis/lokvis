/**
 * EXIF 元数据类型定义
 *
 * 由 schema 层声明,供 Runtime / UI 共享。
 * 实际解析逻辑在 @lokvis/engine-image 的 readExif 中实现,
 * Runtime 通过 readAssetExif(assetId) 桥接,UI 不直接依赖 Engine 包。
 */

/**
 * 结构化 EXIF 数据。
 *
 * 仅保留常见摄影字段;原始 raw 对象也一并返回,供高级用户/调试查看。
 * 字段全部 optional —— 不同相机/手机写入的子集差异极大。
 */
export interface ExifData {
  /** 相机厂商 */
  make?: string;
  /** 相机型号 */
  model?: string;
  /** 镜头型号 */
  lensModel?: string;
  /** 拍摄时间(ISO 字符串,原始 EXIF DateTimeOriginal) */
  dateTimeOriginal?: string;
  /** ISO 感光度 */
  iso?: number;
  /** 光圈 f 值 */
  fNumber?: number;
  /** 快门速度(秒,如 1/125 → 0.008) */
  exposureTime?: number;
  /** 焦距(mm) */
  focalLength?: number;
  /** 曝光补偿(EV) */
  exposureCompensation?: number;
  /** 白平衡模式 */
  whiteBalance?: string;
  /** GPS 纬度(度) */
  gpsLatitude?: number;
  /** GPS 经度(度) */
  gpsLongitude?: number;
  /** GPS 海拔(米) */
  gpsAltitude?: number;
  /** 方向(度,0-360,表示拍摄时相机朝向) */
  orientation?: number;
  /** 软件 / 后期工具(如 "Adobe Photoshop CC") */
  software?: string;
  /** 原始 EXIF 解析对象(全字段,未结构化) */
  raw?: Record<string, unknown>;
}

/**
 * EXIF 键值对行(供 UI 渲染)。
 * label 为人类可读字段名,value 为格式化后的字符串。
 */
export interface ExifRow {
  label: string;
  value: string;
}

/**
 * 将 ExifData 格式化为人类可读的键值对数组,供 UI 渲染。
 *
 * 纯函数:仅依赖 ExifData 类型,不依赖任何 Engine 包。
 * 放在 schema 层供 UI 直接调用,避免 UI 跨层依赖 Engine。
 * raw 字段不展示(体积大、噪音多)。
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
 * 将秒级快门速度格式化为常见分数表示(1/125)。
 * 注:仅做倒数四舍五入,不 snap 到标准档位;非标准值会原样显示(如 1/303s)。
 */
function formatShutterSpeed(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`;
  // 1/125 等:取倒数四舍五入(非标准速度原样显示)
  const denominator = Math.round(1 / seconds);
  return `1/${denominator}s`;
}

/**
 * EXIF 元数据读取(W7 任务 7.3)
 *
 * 使用 exifr 库从图像 Blob 提取 EXIF / IPTC / XMP 元数据。
 * exifr 是轻量(28KB gzip)、零依赖、支持 JPEG / TIFF / HEIC / MP4 / PNG 的
 * 浏览器原生库,符合本仓库 MVP 策略(零 WASM、首屏最快)。
 *
 * 设计:
 * - readExif(blob):一次解析,返回结构化 ExifData(空字段省略)
 * - 解析失败 / 无 EXIF 时返回 null(调用方按需展示空态)
 * - 不抛错:损坏的 EXIF 段不应阻塞图像处理主流程
 */

import exifr from 'exifr';

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
 * 从图像 Blob 读取 EXIF 元数据。
 *
 * @param blob 图像 Blob(JPEG / TIFF / HEIC / PNG / WebP 等)
 * @returns 结构化 ExifData;无 EXIF 或解析失败返回 null
 *
 * @example
 * ```ts
 * const exif = await readExif(imageBlob);
 * if (exif) {
 *   console.log(`${exif.make} ${exif.model} · ISO${exif.iso} · f/${exif.fNumber}`);
 * }
 * ```
 */
export async function readExif(blob: Blob): Promise<ExifData | null> {
  try {
    // exifr.parse 默认合并 EXIF / IPTC / XMP / ICC 等所有可用块
    const parsed = await exifr.parse(blob, { tiff: true, exif: true, gps: true });
    if (!parsed || typeof parsed !== 'object') return null;

    const data: ExifData = {};
    if (typeof parsed.Make === 'string') data.make = parsed.Make;
    if (typeof parsed.Model === 'string') data.model = parsed.Model;
    if (typeof parsed.LensModel === 'string') data.lensModel = parsed.LensModel;
    if (parsed.DateTimeOriginal instanceof Date) {
      data.dateTimeOriginal = parsed.DateTimeOriginal.toISOString();
    } else if (typeof parsed.DateTimeOriginal === 'string') {
      data.dateTimeOriginal = parsed.DateTimeOriginal;
    }
    if (typeof parsed.ISO === 'number') data.iso = parsed.ISO;
    if (typeof parsed.FNumber === 'number') data.fNumber = parsed.FNumber;
    if (typeof parsed.ExposureTime === 'number') data.exposureTime = parsed.ExposureTime;
    if (typeof parsed.FocalLength === 'number') data.focalLength = parsed.FocalLength;
    if (typeof parsed.ExposureCompensation === 'number') {
      data.exposureCompensation = parsed.ExposureCompensation;
    }
    if (typeof parsed.WhiteBalance === 'number') {
      // EXIF WhiteBalance: 0 = Auto, 1 = Manual
      data.whiteBalance = parsed.WhiteBalance === 0 ? 'Auto' : 'Manual';
    }
    if (typeof parsed.latitude === 'number') data.gpsLatitude = parsed.latitude;
    if (typeof parsed.longitude === 'number') data.gpsLongitude = parsed.longitude;
    if (typeof parsed.GPSAltitude === 'number') data.gpsAltitude = parsed.GPSAltitude;
    if (typeof parsed.Orientation === 'number') data.orientation = parsed.Orientation;
    if (typeof parsed.Software === 'string') data.software = parsed.Software;

    // 至少有一个有效字段才返回,避免空对象
    const hasData = Object.keys(data).length > 0;
    if (!hasData) return null;

    data.raw = parsed as Record<string, unknown>;
    return data;
  } catch {
    // 损坏的 EXIF 段或不受支持的格式:静默返回 null,不阻塞主流程
    return null;
  }
}

/**
 * 将 ExifData 格式化为人类可读的键值对数组,供 UI 渲染。
 *
 * 过滤掉 undefined 字段,值为字符串(数字按需格式化)。
 * raw 字段不展示(体积大、噪音多)。
 *
 * @example
 * ```ts
 * const rows = formatExifRows(exif);
 * // [{ label: 'Camera', value: 'Canon EOS R5' }, ...]
 * ```
 */
export function formatExifRows(exif: ExifData): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
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

/** 将秒级快门速度格式化为常见分数表示(1/125) */
function formatShutterSpeed(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`;
  // 1/125 等:取最接近的标准档位
  const denominator = Math.round(1 / seconds);
  return `1/${denominator}s`;
}

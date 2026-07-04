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
 *
 * 类型契约:ExifData / ExifRow / formatExifRows 在 @lokvis/schema 声明,
 * Runtime 通过 readAssetExif(assetId) 桥接,UI 不直接依赖 Engine 包。
 */

import exifr from 'exifr';
import type { ExifData } from '@lokvis/schema';

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
      // EXIF WhiteBalance: 0 = Auto, 1 = Manual;其他值保留为 unknown
      if (parsed.WhiteBalance === 0) data.whiteBalance = 'Auto';
      else if (parsed.WhiteBalance === 1) data.whiteBalance = 'Manual';
      else data.whiteBalance = `Unknown (${parsed.WhiteBalance})`;
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

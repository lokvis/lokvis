/**
 * EXIF 元数据读取实现(W7.3)
 *
 * 架构定位:本文件位于 Capability 层(plugin-image),不是 Engine 层。
 * 原因:readExif 是 Blob → ExifData(结构化对象),不符合 AGENTS.md 规定的
 * Engine 层 Blob↔Blob 纯函数约束。故 exifr 调用放在 plugin-image,通过
 * MetadataReader 机制注册给 Runtime,UI 经 runtime.readAssetExif 间接调用。
 *
 * 类型说明(见 schema/src/exif.ts):
 * - 本函数返回 ExifData(无 raw),直接构造,不做"先填 RawExifData 再删 raw"的 patch
 * - RawExifData 仅供调试 / 高级面板场景在 Plugin 内部其他地方使用(本函数不需要)
 */

import exifr from 'exifr';
import type { ExifData } from '@lokvis/schema';

/**
 * 从图像 Blob 解析 EXIF 元数据。
 *
 * @param blob 图像 Blob(JPEG / TIFF / HEIC 等含 EXIF 的格式)
 * @returns ExifData(无 raw);无 EXIF / 解析失败 / 非图像返回 null
 */
export async function readExifFromBlob(blob: Blob): Promise<ExifData | null> {
  try {
    const parsed = await exifr.parse(blob, {
      tiff: true,
      exif: true,
      gps: true,
    });
    if (!parsed || typeof parsed !== 'object') return null;

    // 直接构造 ExifData(无 raw 字段),避免"先填 RawExifData 再解构删 raw"的 patch
    const exifData: ExifData = {};

    // 相机信息
    if (typeof parsed.Make === 'string') exifData.make = parsed.Make;
    if (typeof parsed.Model === 'string') exifData.model = parsed.Model;
    if (typeof parsed.LensModel === 'string') exifData.lensModel = parsed.LensModel;

    // 拍摄时间(exifr 通常返回 Date 对象,转为 ISO 字符串)
    if (parsed.DateTimeOriginal instanceof Date) {
      exifData.dateTimeOriginal = parsed.DateTimeOriginal.toISOString();
    } else if (typeof parsed.DateTimeOriginal === 'string') {
      exifData.dateTimeOriginal = parsed.DateTimeOriginal;
    }

    // 曝光参数
    if (typeof parsed.ISO === 'number') exifData.iso = parsed.ISO;
    if (typeof parsed.FNumber === 'number') exifData.fNumber = parsed.FNumber;
    if (typeof parsed.ExposureTime === 'number') exifData.exposureTime = parsed.ExposureTime;
    if (typeof parsed.FocalLength === 'number') exifData.focalLength = parsed.FocalLength;
    if (typeof parsed.ExposureCompensation === 'number') {
      exifData.exposureCompensation = parsed.ExposureCompensation;
    }

    // 白平衡:EXIF 规范 0=Auto, 1=Manual, 其他保留原始值
    if (typeof parsed.WhiteBalance === 'number') {
      if (parsed.WhiteBalance === 0) exifData.whiteBalance = 'Auto';
      else if (parsed.WhiteBalance === 1) exifData.whiteBalance = 'Manual';
      else exifData.whiteBalance = `Unknown (${parsed.WhiteBalance})`;
    }

    // GPS
    if (typeof parsed.latitude === 'number') exifData.gpsLatitude = parsed.latitude;
    if (typeof parsed.longitude === 'number') exifData.gpsLongitude = parsed.longitude;
    if (typeof parsed.GPSAltitude === 'number') exifData.gpsAltitude = parsed.GPSAltitude;

    // 方向
    if (typeof parsed.Orientation === 'number') exifData.orientation = parsed.Orientation;

    // 软件
    if (typeof parsed.Software === 'string') exifData.software = parsed.Software;

    return exifData;
  } catch {
    // exifr 解析失败(损坏数据 / 不支持的格式)静默返回 null
    return null;
  }
}

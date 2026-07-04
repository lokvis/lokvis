/**
 * EXIF 元数据读取实现(W7.3)
 *
 * 架构定位:本文件位于 Capability 层(plugin-image),不是 Engine 层。
 * 原因:readExif 是 Blob → ExifData(结构化对象),不符合 AGENTS.md 规定的
 * Engine 层 Blob↔Blob 纯函数约束。故 exifr 调用放在 plugin-image,通过
 * MetadataReader 机制注册给 Runtime,UI 经 runtime.readAssetExif 间接调用。
 *
 * 类型分两层(见 schema/src/exif.ts):
 * - 内部构造 RawExifData(含 raw,保留 exifr 原始对象供调试)
 * - 返回前收窄为 ExifData(丢弃 raw),避免大对象传递到 UI 缓存
 */

import exifr from 'exifr';
import type { ExifData, RawExifData } from '@lokvis/schema';

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

    const data: RawExifData = {};

    // 相机信息
    if (typeof parsed.Make === 'string') data.make = parsed.Make;
    if (typeof parsed.Model === 'string') data.model = parsed.Model;
    if (typeof parsed.LensModel === 'string') data.lensModel = parsed.LensModel;

    // 拍摄时间(exifr 通常返回 Date 对象,转为 ISO 字符串)
    if (parsed.DateTimeOriginal instanceof Date) {
      data.dateTimeOriginal = parsed.DateTimeOriginal.toISOString();
    } else if (typeof parsed.DateTimeOriginal === 'string') {
      data.dateTimeOriginal = parsed.DateTimeOriginal;
    }

    // 曝光参数
    if (typeof parsed.ISO === 'number') data.iso = parsed.ISO;
    if (typeof parsed.FNumber === 'number') data.fNumber = parsed.FNumber;
    if (typeof parsed.ExposureTime === 'number') data.exposureTime = parsed.ExposureTime;
    if (typeof parsed.FocalLength === 'number') data.focalLength = parsed.FocalLength;
    if (typeof parsed.ExposureCompensation === 'number') {
      data.exposureCompensation = parsed.ExposureCompensation;
    }

    // 白平衡:EXIF 规范 0=Auto, 1=Manual, 其他保留原始值
    if (typeof parsed.WhiteBalance === 'number') {
      if (parsed.WhiteBalance === 0) data.whiteBalance = 'Auto';
      else if (parsed.WhiteBalance === 1) data.whiteBalance = 'Manual';
      else data.whiteBalance = `Unknown (${parsed.WhiteBalance})`;
    }

    // GPS
    if (typeof parsed.latitude === 'number') data.gpsLatitude = parsed.latitude;
    if (typeof parsed.longitude === 'number') data.gpsLongitude = parsed.longitude;
    if (typeof parsed.GPSAltitude === 'number') data.gpsAltitude = parsed.GPSAltitude;

    // 方向
    if (typeof parsed.Orientation === 'number') data.orientation = parsed.Orientation;

    // 软件
    if (typeof parsed.Software === 'string') data.software = parsed.Software;

    // 保留 raw 供调试 / 未来高级面板(收窄前)
    data.raw = parsed as Record<string, unknown>;

    // 收窄为 ExifData:丢弃 raw 字段
    // 解构分离 raw,其余字段构成 ExifData
    const { raw: _raw, ...exifData } = data;
    void _raw;
    return exifData;
  } catch {
    // exifr 解析失败(损坏数据 / 不支持的格式)静默返回 null
    return null;
  }
}

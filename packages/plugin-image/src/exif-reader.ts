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
 *
 * TD-3.4 长期方案:catch 不再静默吞错,通过 options.log('warn', ...) 上报
 * 解析异常,与"无 EXIF"(parse 返回 null)区分。options.log 默认为 console.warn,
 * Plugin 注册时通过 MetadataReaderContext.log 透传 runtime 侧日志通道。
 */

import exifr from 'exifr';
import type { ExifData } from '@lokvis/schema';

/** readExifFromBlob 选项(TD-3.4 长期方案:可观测信号) */
export interface ExifReaderOptions {
  /**
   * 日志函数,签名与 MetadataReaderContext.log / ExecutionContext.log 一致。
   * 未提供时默认为 `(level, msg) => console[level]('[lokvis:exif-reader] ' + msg)`。
   * Plugin 注册路径通过 MetadataReaderContext.log 透传;独立调用(测试 / 脚本)
   * 可不传,走 console 默认通道。
   */
  log?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

/** 默认日志:未注入 logger 时走 console(独立调用场景) */
const defaultLog = (level: 'info' | 'warn' | 'error', message: string): void => {
  const fn = level === 'info' ? console.info : level === 'warn' ? console.warn : console.error;
  fn(`[lokvis:exif-reader] ${message}`);
};

/**
 * 从图像 Blob 解析 EXIF 元数据。
 *
 * @param blob 图像 Blob(JPEG / TIFF / HEIC 等含 EXIF 的格式)
 * @param options 选项(可选);提供 log 以接收解析异常日志
 * @returns ExifData(无 raw);无 EXIF / 解析失败 / 非图像返回 null
 */
export async function readExifFromBlob(
  blob: Blob,
  options: ExifReaderOptions = {}
): Promise<ExifData | null> {
  const log = options.log ?? defaultLog;
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
  } catch (err) {
    // TD-3.4 长期方案:不静默吞错。区分"无 EXIF"(parse 返回 null,无日志)
    // 与"解析异常"(exifr 抛错,log warn 后返回 null)。便于 Sentry 上报与调试。
    log(
      'warn',
      `EXIF parse failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

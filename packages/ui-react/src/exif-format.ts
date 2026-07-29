/**
 * EXIF 行格式化(W7.4,归位自 @lokvis/schema)
 *
 * EXIF 展示逻辑属 UI 职责,放 ui-react 层。schema 只承载 ExifData / ExifRow 类型。
 * ExifPanel 直接消费 formatExifRows,避免把展示函数下沉到 schema 稳定核心。
 */
import type { ExifData, ExifRow } from '@lokvis/schema';

/**
 * 把 ExifData 格式化为 UI 展示用的行列表。
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

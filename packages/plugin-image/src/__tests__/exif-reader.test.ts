/**
 * EXIF 读取实现测试(W7.9)
 *
 * 覆盖 readExifFromBlob:
 * - 正常解析全字段
 * - 无 EXIF(空对象)返回 null
 * - exifr 抛错返回 null
 * - Date 对象转 ISO 字符串
 * - WhiteBalance 三值化(0/1/else)
 * - 返回的 ExifData 不含 raw 字段(类型分层验证)
 *
 * 不依赖真实 JPEG:通过 vi.mock 替换 exifr,直接控制 parse 返回值。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExifData } from '@lokvis/schema';

// 桩 exifr:每用例通过 mockParse.mockResolvedValue 控制返回
const mockParse = vi.fn();
vi.mock('exifr', () => ({
  default: {
    parse: (...args: unknown[]) => mockParse(...args),
  },
}));

const { readExifFromBlob } = await import('../exif-reader.js');

beforeEach(() => {
  mockParse.mockReset();
});

describe('readExifFromBlob', () => {
  it('无 EXIF(parse 返回 null)应返回 null', async () => {
    mockParse.mockResolvedValue(null);
    const result = await readExifFromBlob(new Blob([]));
    expect(result).toBeNull();
  });

  it('parse 返回非对象应返回 null', async () => {
    mockParse.mockResolvedValue('not an object');
    const result = await readExifFromBlob(new Blob([]));
    expect(result).toBeNull();
  });

  it('exifr 抛错应 log warn 后返回 null(TD-3.4:不再静默吞错)', async () => {
    mockParse.mockRejectedValue(new Error('parse boom'));
    const log = vi.fn();
    const result = await readExifFromBlob(new Blob([]), { log });
    expect(result).toBeNull();
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('parse boom'));
  });

  it('exifr 抛错未注入 log 时走默认 console.warn(TD-3.4)', async () => {
    mockParse.mockRejectedValue(new Error('default console boom'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await readExifFromBlob(new Blob([]));
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[lokvis:exif-reader] EXIF parse failed: default console boom')
    );
    warnSpy.mockRestore();
  });

  it('无 EXIF(parse 返回 null)不应调用 log(TD-3.4:区分"无 EXIF"与"解析异常")', async () => {
    mockParse.mockResolvedValue(null);
    const log = vi.fn();
    const result = await readExifFromBlob(new Blob([]), { log });
    expect(result).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it('应解析全字段并返回 ExifData(不含 raw)', async () => {
    const date = new Date('2026-01-15T10:30:00Z');
    mockParse.mockResolvedValue({
      Make: 'Canon',
      Model: 'EOS R5',
      LensModel: 'RF 24-70 F2.8',
      DateTimeOriginal: date,
      ISO: 400,
      FNumber: 2.8,
      ExposureTime: 0.004,
      FocalLength: 50,
      ExposureCompensation: -0.7,
      WhiteBalance: 0,
      latitude: 39.9042,
      longitude: 116.4074,
      GPSAltitude: 43.5,
      Orientation: 6,
      Software: 'Lightroom',
    });
    const result = await readExifFromBlob(new Blob([]));
    expect(result).not.toBeNull();
    const exif = result as ExifData;
    expect(exif.make).toBe('Canon');
    expect(exif.model).toBe('EOS R5');
    expect(exif.lensModel).toBe('RF 24-70 F2.8');
    expect(exif.dateTimeOriginal).toBe(date.toISOString());
    expect(exif.iso).toBe(400);
    expect(exif.fNumber).toBe(2.8);
    expect(exif.exposureTime).toBe(0.004);
    expect(exif.focalLength).toBe(50);
    expect(exif.exposureCompensation).toBe(-0.7);
    expect(exif.whiteBalance).toBe('Auto');
    expect(exif.gpsLatitude).toBe(39.9042);
    expect(exif.gpsLongitude).toBe(116.4074);
    expect(exif.gpsAltitude).toBe(43.5);
    expect(exif.orientation).toBe(6);
    expect(exif.software).toBe('Lightroom');
    // 关键:返回的 ExifData 不应含 raw 字段(类型分层根治)
    expect('raw' in exif).toBe(false);
  });

  it('WhiteBalance=1 应转为 Manual', async () => {
    mockParse.mockResolvedValue({ WhiteBalance: 1 });
    const result = await readExifFromBlob(new Blob([]));
    expect((result as ExifData).whiteBalance).toBe('Manual');
  });

  it('WhiteBalance=其他值应保留原始数字', async () => {
    mockParse.mockResolvedValue({ WhiteBalance: 99 });
    const result = await readExifFromBlob(new Blob([]));
    expect((result as ExifData).whiteBalance).toBe('Unknown (99)');
  });

  it('DateTimeOriginal 为字符串时应直接保留', async () => {
    mockParse.mockResolvedValue({ DateTimeOriginal: '2026:01:15 10:30:00' });
    const result = await readExifFromBlob(new Blob([]));
    expect((result as ExifData).dateTimeOriginal).toBe('2026:01:15 10:30:00');
  });

  it('部分字段缺失时只返回存在的字段', async () => {
    mockParse.mockResolvedValue({ Make: 'Sony', ISO: 200 });
    const result = await readExifFromBlob(new Blob([]));
    const exif = result as ExifData;
    expect(exif.make).toBe('Sony');
    expect(exif.iso).toBe(200);
    expect(exif.model).toBeUndefined();
    expect(exif.fNumber).toBeUndefined();
  });

  it('GPS 只有经度无纬度时不应设置 gpsLatitude', async () => {
    mockParse.mockResolvedValue({ longitude: 116.4074 });
    const result = await readExifFromBlob(new Blob([]));
    const exif = result as ExifData;
    expect(exif.gpsLongitude).toBe(116.4074);
    expect(exif.gpsLatitude).toBeUndefined();
  });
});

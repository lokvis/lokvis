/**
 * EXIF 类型与格式化函数测试(W7.9)
 *
 * 覆盖:
 * - formatExifRows:字段格式化、空字段过滤、GPS 合并、快门速度分数转换
 * - ExifData / RawExifData 类型分层的运行时行为(收窄丢弃 raw)
 */
import { describe, it, expect } from 'vitest';
import { formatExifRows, type ExifData, type RawExifData } from '@lokvis/schema';

describe('formatExifRows', () => {
  it('空 ExifData 应返回空数组', () => {
    expect(formatExifRows({})).toEqual([]);
  });

  it('应格式化相机型号(make + model 合并)', () => {
    const rows = formatExifRows({ make: 'Canon', model: 'EOS R5' });
    const camera = rows.find((r) => r.label === 'Camera');
    expect(camera?.value).toBe('Canon EOS R5');
  });

  it('只有 make 时也应展示', () => {
    const rows = formatExifRows({ make: 'Nikon' });
    expect(rows.find((r) => r.label === 'Camera')?.value).toBe('Nikon');
  });

  it('应格式化 ISO / 光圈 / 焦距', () => {
    const rows = formatExifRows({ iso: 400, fNumber: 2.8, focalLength: 50 });
    expect(rows.find((r) => r.label === 'ISO')?.value).toBe('ISO 400');
    expect(rows.find((r) => r.label === 'Aperture')?.value).toBe('f/2.8');
    expect(rows.find((r) => r.label === 'Focal Length')?.value).toBe('50mm');
  });

  it('快门速度 < 1s 应转为分数', () => {
    const rows = formatExifRows({ exposureTime: 0.004 });
    expect(rows.find((r) => r.label === 'Shutter')?.value).toBe('1/250s');
  });

  it('快门速度 >= 1s 应直接显示秒数', () => {
    const rows = formatExifRows({ exposureTime: 2 });
    expect(rows.find((r) => r.label === 'Shutter')?.value).toBe('2s');
  });

  it('应合并 GPS 经纬度并展示海拔', () => {
    const rows = formatExifRows({
      gpsLatitude: 39.9042,
      gpsLongitude: 116.4074,
      gpsAltitude: 43.5,
    });
    expect(rows.find((r) => r.label === 'GPS')?.value).toBe('39.904200, 116.407400');
    expect(rows.find((r) => r.label === 'GPS Altitude')?.value).toBe('43.5 m');
  });

  it('只有经度无纬度时不展示 GPS', () => {
    const rows = formatExifRows({ gpsLongitude: 116.4074 });
    expect(rows.find((r) => r.label === 'GPS')).toBeUndefined();
  });

  it('应过滤 undefined 和空字符串字段', () => {
    const rows = formatExifRows({
      make: 'Sony',
      lensModel: '',
      software: undefined,
    });
    const labels = rows.map((r) => r.label);
    expect(labels).toContain('Camera');
    expect(labels).not.toContain('Lens');
    expect(labels).not.toContain('Software');
  });

  it('应展示曝光补偿和白平衡', () => {
    const rows = formatExifRows({
      exposureCompensation: -0.7,
      whiteBalance: 'Auto',
    });
    expect(rows.find((r) => r.label === 'Exposure Comp.')?.value).toBe('-0.7 EV');
    expect(rows.find((r) => r.label === 'White Balance')?.value).toBe('Auto');
  });
});

describe('ExifData / RawExifData 类型分层', () => {
  it('RawExifData 收窄为 ExifData 后应丢弃 raw 字段', () => {
    const raw: RawExifData = {
      make: 'Canon',
      iso: 100,
      raw: { Make: 'Canon', ISO: 100, SomeField: 'debug' },
    };
    // 模拟 plugin readExifFromBlob 的收窄逻辑:解构分离 raw
    const { raw: _raw, ...exifData } = raw;
    void _raw;
    const exif: ExifData = exifData;
    expect(exif.make).toBe('Canon');
    expect(exif.iso).toBe(100);
    // exif 上不应有 raw 字段(TS 层面已保证,运行时验证)
    expect('raw' in exif).toBe(false);
  });
});

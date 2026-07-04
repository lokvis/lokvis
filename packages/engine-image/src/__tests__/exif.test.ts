/**
 * EXIF 读取(W7.3 / W7.9)单元测试
 *
 * 覆盖:
 * - readExif:正常解析 / 无 EXIF / 损坏数据 / 部分字段(engine-image 层)
 * - formatExifRows:字段格式化、空字段过滤、GPS 合并(schema 层纯函数)
 *
 * 架构:ExifData/ExifRow 类型 + formatExifRows 纯函数定义在 @lokvis/schema,
 * readExif 解析逻辑在 @lokvis/engine-image。测试 import 来源与此一致。
 *
 * 不依赖真实 JPEG:通过 vi.mock 替换 exifr,直接控制 parse 返回值,
 * 覆盖各分支(全字段 / 空对象 / 抛错 / Date 实例 vs 字符串)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatExifRows } from '@lokvis/schema';

// 桩 exifr:每用例通过 mockParse.mockResolvedValue 控制返回
const mockParse = vi.fn();
vi.mock('exifr', () => ({
  default: {
    parse: (...args: unknown[]) => mockParse(...args),
  },
}));

const { readExif } = await import('../operations/exif.js');

const pngBlob = (): Blob =>
  new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

describe('readExif', () => {
  beforeEach(() => {
    mockParse.mockReset();
  });

  it('应解析全字段并返回结构化 ExifData', async () => {
    mockParse.mockResolvedValue({
      Make: 'Canon',
      Model: 'EOS R5',
      LensModel: 'RF 24-70 F2.8',
      DateTimeOriginal: new Date('2024-06-15T10:30:00Z'),
      ISO: 200,
      FNumber: 2.8,
      ExposureTime: 0.008, // 1/125
      FocalLength: 50,
      ExposureCompensation: -0.3,
      WhiteBalance: 0, // Auto
      latitude: 31.230416,
      longitude: 121.473701,
      GPSAltitude: 4.5,
      Orientation: 6,
      Software: 'Lightroom 6.0',
    });

    const data = await readExif(pngBlob());

    expect(data).not.toBeNull();
    expect(data!.make).toBe('Canon');
    expect(data!.model).toBe('EOS R5');
    expect(data!.lensModel).toBe('RF 24-70 F2.8');
    expect(data!.dateTimeOriginal).toBe('2024-06-15T10:30:00.000Z');
    expect(data!.iso).toBe(200);
    expect(data!.fNumber).toBe(2.8);
    expect(data!.exposureTime).toBe(0.008);
    expect(data!.focalLength).toBe(50);
    expect(data!.exposureCompensation).toBe(-0.3);
    expect(data!.whiteBalance).toBe('Auto');
    expect(data!.gpsLatitude).toBeCloseTo(31.230416);
    expect(data!.gpsLongitude).toBeCloseTo(121.473701);
    expect(data!.gpsAltitude).toBeCloseTo(4.5);
    expect(data!.orientation).toBe(6);
    expect(data!.software).toBe('Lightroom 6.0');
    // raw 应携带原始对象
    expect(data!.raw).toBeDefined();
    expect(data!.raw!['Make']).toBe('Canon');
  });

  it('WhiteBalance=1 应解析为 Manual', async () => {
    mockParse.mockResolvedValue({
      WhiteBalance: 1,
    });
    const data = await readExif(pngBlob());
    expect(data!.whiteBalance).toBe('Manual');
  });

  it('DateTimeOriginal 为字符串时应原样保留', async () => {
    mockParse.mockResolvedValue({
      DateTimeOriginal: '2024:06:15 10:30:00',
    });
    const data = await readExif(pngBlob());
    expect(data!.dateTimeOriginal).toBe('2024:06:15 10:30:00');
  });

  it('parse 返回空对象时应返回 null', async () => {
    mockParse.mockResolvedValue({});
    const data = await readExif(pngBlob());
    expect(data).toBeNull();
  });

  it('parse 返回 null 时应返回 null', async () => {
    mockParse.mockResolvedValue(null);
    const data = await readExif(pngBlob());
    expect(data).toBeNull();
  });

  it('parse 抛错时应捕获并返回 null(不阻塞主流程)', async () => {
    mockParse.mockRejectedValue(new Error('corrupt EXIF segment'));
    const data = await readExif(pngBlob());
    expect(data).toBeNull();
  });

  it('部分字段缺失时应仅返回存在的字段', async () => {
    mockParse.mockResolvedValue({
      Make: 'Apple',
      Model: 'iPhone 15 Pro',
      ISO: 100,
      // 其余字段缺失
    });
    const data = await readExif(pngBlob());
    expect(data!.make).toBe('Apple');
    expect(data!.model).toBe('iPhone 15 Pro');
    expect(data!.iso).toBe(100);
    expect(data!.fNumber).toBeUndefined();
    expect(data!.gpsLatitude).toBeUndefined();
  });

  it('parse 返回非对象类型时应返回 null', async () => {
    mockParse.mockResolvedValue('not an object');
    const data = await readExif(pngBlob());
    expect(data).toBeNull();
  });
});

describe('formatExifRows', () => {
  it('应格式化全字段为可读键值对', () => {
    const rows = formatExifRows({
      make: 'Canon',
      model: 'EOS R5',
      lensModel: 'RF 24-70',
      dateTimeOriginal: '2024-06-15T10:30:00.000Z',
      iso: 200,
      fNumber: 2.8,
      exposureTime: 0.008,
      focalLength: 50,
      exposureCompensation: -0.3,
      whiteBalance: 'Auto',
      software: 'LR 6.0',
      gpsLatitude: 31.230416,
      gpsLongitude: 121.473701,
      gpsAltitude: 4.5,
      orientation: 6,
    });

    const labels = rows.map((r) => r.label);
    expect(labels).toContain('Camera');
    expect(labels).toContain('Lens');
    expect(labels).toContain('Date');
    expect(labels).toContain('ISO');
    expect(labels).toContain('Aperture');
    expect(labels).toContain('Shutter');
    expect(labels).toContain('Focal Length');
    expect(labels).toContain('Exposure Comp.');
    expect(labels).toContain('White Balance');
    expect(labels).toContain('Software');
    expect(labels).toContain('GPS');
    expect(labels).toContain('GPS Altitude');
    expect(labels).toContain('Orientation');

    const camera = rows.find((r) => r.label === 'Camera');
    expect(camera?.value).toBe('Canon EOS R5');
    const iso = rows.find((r) => r.label === 'ISO');
    expect(iso?.value).toBe('ISO 200');
    const aperture = rows.find((r) => r.label === 'Aperture');
    expect(aperture?.value).toBe('f/2.8');
    const shutter = rows.find((r) => r.label === 'Shutter');
    expect(shutter?.value).toBe('1/125s');
    const focal = rows.find((r) => r.label === 'Focal Length');
    expect(focal?.value).toBe('50mm');
    const gps = rows.find((r) => r.label === 'GPS');
    expect(gps?.value).toBe('31.230416, 121.473701');
  });

  it('快门速度 >= 1 秒时应显示整数秒', () => {
    const rows = formatExifRows({ exposureTime: 2 });
    const shutter = rows.find((r) => r.label === 'Shutter');
    expect(shutter?.value).toBe('2s');
  });

  it('应过滤 undefined 字段(空 ExifData 返回空数组)', () => {
    const rows = formatExifRows({});
    expect(rows).toEqual([]);
  });

  it('只有 make 时 Camera 应只显示 make', () => {
    const rows = formatExifRows({ make: 'Sony' });
    const camera = rows.find((r) => r.label === 'Camera');
    expect(camera?.value).toBe('Sony');
  });

  it('只有 model 时 Camera 应只显示 model', () => {
    const rows = formatExifRows({ model: 'A7R V' });
    const camera = rows.find((r) => r.label === 'Camera');
    expect(camera?.value).toBe('A7R V');
  });

  it('GPS 字段应仅在经纬度同时存在时展示', () => {
    // 只有纬度,不展示 GPS
    const rows1 = formatExifRows({ gpsLatitude: 31.23 });
    expect(rows1.find((r) => r.label === 'GPS')).toBeUndefined();

    // 经纬度都有,展示 GPS(altitude 可选)
    const rows2 = formatExifRows({
      gpsLatitude: 31.23,
      gpsLongitude: 121.47,
    });
    expect(rows2.find((r) => r.label === 'GPS')?.value).toBe('31.230000, 121.470000');
    expect(rows2.find((r) => r.label === 'GPS Altitude')).toBeUndefined();
  });

  it('空字符串字段应被过滤', () => {
    const rows = formatExifRows({ software: '' });
    expect(rows.find((r) => r.label === 'Software')).toBeUndefined();
  });

  it('raw 字段不应出现在 rows 中', () => {
    const rows = formatExifRows({
      make: 'Canon',
      raw: { Make: 'Canon', PrivateField: 'secret' },
    });
    expect(rows.find((r) => r.label === 'raw')).toBeUndefined();
    expect(rows.find((r) => r.label === 'Camera')?.value).toBe('Canon');
  });
});

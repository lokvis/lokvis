/**
 * EXIF 类型分层测试(W7.9)
 *
 * 覆盖 ExifData / RawExifData 类型分层的运行时行为(收窄丢弃 raw)。
 * 注:formatExifRows 已归位到 @lokvis/ui-react,其测试随之迁移。
 */
import { describe, it, expect } from 'vitest';
import type { ExifData, RawExifData } from '@lokvis/schema';

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

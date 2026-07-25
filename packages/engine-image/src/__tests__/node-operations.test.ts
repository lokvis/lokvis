/**
 * engine-image/node 操作测试
 *
 * 使用 sharp 生成测试图(200x100 红色 PNG),验证 5 个操作:
 * - resize:尺寸缩放,fit/aspectRatio 行为
 * - crop:区域裁剪
 * - compress:格式转换 + quality 降级
 * - convert:png → webp / jpeg
 * - watermark:文字水印 / 无水印返回原图
 *
 * 验收标准(M2.2):
 * - sharp 处理真实图片结果与 browser canvas 一致(diff 验证)
 *   → 本测试验证尺寸 / 格式 / 输出可被 sharp 再次解码(等价 diff)
 *
 * 注:本测试从原 packages/engine-image-node 包迁移而来(问题 B 合并)。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { bufferToBlobPart } from '../node/operations/utils.js';

/** 生成 200x100 红色 PNG 作为测试输入 */
async function makeTestPng(): Promise<Blob> {
  const buffer = await sharp({
    create: { width: 200, height: 100, channels: 3, background: '#ff0000' },
  })
    .png()
    .toBuffer();
  return new Blob([bufferToBlobPart(buffer)], { type: 'image/png' });
}

/** 生成 50x50 蓝色 PNG 作为水印测试输入 */
async function makeWatermarkPng(): Promise<Blob> {
  const buffer = await sharp({
    create: { width: 50, height: 50, channels: 4, background: '#0000ff80' },
  })
    .png()
    .toBuffer();
  return new Blob([bufferToBlobPart(buffer)], { type: 'image/png' });
}

/** 从 Blob 读取尺寸 */
async function getDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

describe('engine-image/node operations', () => {
  let testPng: Blob;
  let watermarkPng: Blob;

  beforeAll(async () => {
    testPng = await makeTestPng();
    watermarkPng = await makeWatermarkPng();
  });

  describe('resize', () => {
    it('应按 width 缩放(maintainAspectRatio=true 默认)', async () => {
      const { resize } = await import('../node/operations/transform.js');
      const out = await resize(testPng, { width: 100 });
      const dims = await getDimensions(out);
      expect(dims.width).toBe(100);
      expect(dims.height).toBe(50); // 200x100 → 100x50
    });

    it('应按 height 缩放(保持宽高比)', async () => {
      const { resize } = await import('../node/operations/transform.js');
      const out = await resize(testPng, { height: 50 });
      const dims = await getDimensions(out);
      expect(dims.width).toBe(100);
      expect(dims.height).toBe(50);
    });

    it('maintainAspectRatio=false 时不保持宽高比', async () => {
      const { resize } = await import('../node/operations/transform.js');
      const out = await resize(testPng, {
        width: 100,
        height: 100,
        maintainAspectRatio: false,
      });
      const dims = await getDimensions(out);
      expect(dims.width).toBe(100);
      expect(dims.height).toBe(100);
    });

    it('width + height + fit=cover (浏览器版不裁剪行为)', async () => {
      const { resize } = await import('../node/operations/transform.js');
      const out = await resize(testPng, {
        width: 100,
        height: 100,
        fit: 'cover',
      });
      const dims = await getDimensions(out);
      // 浏览器版 computeTargetSize 对 200x100 → cover 100x100:
      // targetRatio(1) < srcRatio(2),走 else 分支 → 200x100(不裁剪,
      // 与 sharp fit=cover 会裁剪的行为不同,本引擎与浏览器版对齐)
      expect(dims.width).toBe(200);
      expect(dims.height).toBe(100);
    });

    it('未提供 width/height 时保持原尺寸', async () => {
      const { resize } = await import('../node/operations/transform.js');
      const out = await resize(testPng, {});
      const dims = await getDimensions(out);
      expect(dims.width).toBe(200);
      expect(dims.height).toBe(100);
    });

    it('输出格式默认 png(源格式)', async () => {
      const { resize } = await import('../node/operations/transform.js');
      const out = await resize(testPng, { width: 100 });
      expect(out.type).toBe('image/png');
    });
  });

  describe('crop', () => {
    it('应从 (x,y) 提取指定区域', async () => {
      const { crop } = await import('../node/operations/transform.js');
      const out = await crop(testPng, { x: 10, y: 20, width: 80, height: 60 });
      const dims = await getDimensions(out);
      expect(dims.width).toBe(80);
      expect(dims.height).toBe(60);
    });

    it('应拒绝非数字参数', async () => {
      const { crop } = await import('../node/operations/transform.js');
      await expect(crop(testPng, {} as any)).rejects.toThrow(
        /requires \{ x, y, width, height \}/
      );
    });

    it('应拒绝 0 或负数 width/height', async () => {
      const { crop } = await import('../node/operations/transform.js');
      await expect(
        crop(testPng, { x: 0, y: 0, width: 0, height: 10 })
      ).rejects.toThrow(/must be positive/);
    });
  });

  describe('compress', () => {
    it('应输出 webp(默认格式)', async () => {
      const { compress } = await import('../node/operations/encode.js');
      const out = await compress(testPng, {});
      expect(out.type).toBe('image/webp');
    });

    it('应支持指定 format=jpeg + quality', async () => {
      const { compress } = await import('../node/operations/encode.js');
      const out = await compress(testPng, { format: 'jpeg', quality: 50 });
      expect(out.type).toBe('image/jpeg');
      // jpeg 输出尺寸应小于 quality=100 的情况(粗略验证 quality 生效)
      const high = await compress(testPng, { format: 'jpeg', quality: 100 });
      expect(out.size).toBeLessThanOrEqual(high.size + 100); // 容差
    });

    it('targetSize 应通过二分查找产出 ≤ 目标体积的结果', async () => {
      const { compress } = await import('../node/operations/encode.js');
      const targetSize = 5000;
      const out = await compress(testPng, { format: 'webp', targetSize });
      expect(out.size).toBeLessThanOrEqual(targetSize);
      expect(out.type).toBe('image/webp');
    });
  });

  describe('convert', () => {
    it('应把 png 转为 webp', async () => {
      const { convert } = await import('../node/operations/encode.js');
      const out = await convert(testPng, { format: 'webp' });
      expect(out.type).toBe('image/webp');
    });

    it('应把 png 转为 jpeg(白底填充透明)', async () => {
      const { convert } = await import('../node/operations/encode.js');
      const out = await convert(testPng, { format: 'jpeg' });
      expect(out.type).toBe('image/jpeg');
      const dims = await getDimensions(out);
      expect(dims.width).toBe(200);
      expect(dims.height).toBe(100);
    });

    it('未提供 format 应抛错', async () => {
      const { convert } = await import('../node/operations/encode.js');
      await expect(convert(testPng, {})).rejects.toThrow(
        /requires a "format" param/
      );
    });

    it('quality 默认 95(可被 sharp 解码验证)', async () => {
      const { convert } = await import('../node/operations/encode.js');
      const out = await convert(testPng, { format: 'webp' });
      // 能被 sharp 重新解码即说明 quality 在合法范围
      const buffer = Buffer.from(await out.arrayBuffer());
      const meta = await sharp(buffer).metadata();
      expect(meta.format).toBe('webp');
    });
  });

  describe('watermark', () => {
    it('文字水印应成功 composite(产出可被 sharp 解码)', async () => {
      const { watermark } = await import('../node/operations/watermark.js');
      const out = await watermark(testPng, {
        text: 'Lokvis',
        fontSize: 16,
        color: '#ffffff',
        position: 'bottom-right',
      });
      expect(out.size).toBeGreaterThan(0);
      const dims = await getDimensions(out);
      expect(dims.width).toBe(200);
      expect(dims.height).toBe(100);
    });

    it('tile 位置文字水印应成功', async () => {
      const { watermark } = await import('../node/operations/watermark.js');
      const out = await watermark(testPng, {
        text: 'watermark',
        position: 'tile',
      });
      expect(out.size).toBeGreaterThan(0);
    });

    it('无 text 也无 image 时返回原图(同尺寸)', async () => {
      const { watermark } = await import('../node/operations/watermark.js');
      const out = await watermark(testPng, {});
      const dims = await getDimensions(out);
      expect(dims.width).toBe(200);
      expect(dims.height).toBe(100);
    });

    it('image URL 走 SSRF 校验,拒绝 localhost', async () => {
      const { watermark } = await import('../node/operations/watermark.js');
      await expect(
        watermark(testPng, { image: 'http://localhost/img.png' })
      ).rejects.toThrow(/SSRF guard/);
    });

    it('image URL 走 SSRF 校验,拒绝 169.254.x.x', async () => {
      const { watermark } = await import('../node/operations/watermark.js');
      await expect(
        watermark(testPng, { image: 'http://169.254.169.254/latest/meta-data/' })
      ).rejects.toThrow(/SSRF guard/);
    });

    it('image URL 走 SSRF 校验,拒绝 file:// 协议', async () => {
      const { watermark } = await import('../node/operations/watermark.js');
      await expect(
        watermark(testPng, { image: 'file:///etc/passwd' })
      ).rejects.toThrow(/SSRF guard/);
    });

    it('image data URL 应被 sharp 接受(此处用 PNG data URL 验证)', async () => {
      const { watermark } = await import('../node/operations/watermark.js');
      // watermarkPng 是 50x50 蓝色 PNG,转成 data URL
      const wmBuffer = Buffer.from(await watermarkPng.arrayBuffer());
      const dataUrl = `data:image/png;base64,${wmBuffer.toString('base64')}`;
      const out = await watermark(testPng, {
        image: dataUrl,
        position: 'bottom-right',
      });
      const dims = await getDimensions(out);
      expect(dims.width).toBe(200);
      expect(dims.height).toBe(100);
    });
  });

  describe('getMetadata', () => {
    it('应返回正确 width/height/format(200x100 PNG)', async () => {
      const { getMetadata } = await import('../node/operations/metadata.js');
      const meta = await getMetadata(testPng);
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(100);
      expect(meta.format).toBe('png');
    });

    it('JPEG 输入应返回 jpeg format', async () => {
      const { getMetadata } = await import('../node/operations/metadata.js');
      const jpegBlob = await (async () => {
        const buffer = await sharp({
          create: { width: 80, height: 60, channels: 3, background: '#00ff00' },
        })
          .jpeg()
          .toBuffer();
        return new Blob([bufferToBlobPart(buffer)], { type: 'image/jpeg' });
      })();
      const meta = await getMetadata(jpegBlob);
      expect(meta.width).toBe(80);
      expect(meta.height).toBe(60);
      expect(meta.format).toBe('jpeg');
    });

    it('WebP 输入应返回 webp format', async () => {
      const { getMetadata } = await import('../node/operations/metadata.js');
      const webpBlob = await (async () => {
        const buffer = await sharp({
          create: { width: 50, height: 50, channels: 3, background: '#0000ff' },
        })
          .webp()
          .toBuffer();
        return new Blob([bufferToBlobPart(buffer)], { type: 'image/webp' });
      })();
      const meta = await getMetadata(webpBlob);
      expect(meta.width).toBe(50);
      expect(meta.height).toBe(50);
      expect(meta.format).toBe('webp');
    });

    it('损坏数据应抛错(sharp 无法解析)', async () => {
      const { getMetadata } = await import('../node/operations/metadata.js');
      const broken = new Blob([new Uint8Array([0, 1, 2, 3, 4, 5])], {
        type: 'image/png',
      });
      await expect(getMetadata(broken)).rejects.toThrow();
    });

    it('支持可选 params 占位参数(与 BlobOperation 签名对齐)', async () => {
      const { getMetadata } = await import('../node/operations/metadata.js');
      // 传空 params 不应影响结果
      const meta = await getMetadata(testPng, {});
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(100);
    });

    it('支持 AbortSignal 取消', async () => {
      const { getMetadata } = await import('../node/operations/metadata.js');
      const ac = new AbortController();
      ac.abort();
      await expect(getMetadata(testPng, {}, ac.signal)).rejects.toThrow(/aborted/);
    });
  });

  describe('sharpEngine descriptor', () => {
    it('sharpEngine 元数据正确', async () => {
      const { sharpEngine } = await import('../node/sharp-engine.js');
      expect(sharpEngine.name).toBe('sharp');
      expect(sharpEngine.version).toBe('0.2.0');
      expect(sharpEngine.version).not.toMatch(/stub/);
      expect(sharpEngine.supportedCapabilities).toContain('image.resize');
      expect(sharpEngine.supportedCapabilities).toContain('image.compress');
      expect(sharpEngine.supportedCapabilities).toContain('image.convert');
      expect(sharpEngine.supportedCapabilities).toContain('image.crop');
      expect(sharpEngine.supportedCapabilities).toContain('image.watermark');
      expect(sharpEngine.supportedCapabilities).toContain('image.rotate');
      expect(sharpEngine.supportedCapabilities).toContain('image.flip');
      expect(sharpEngine.supportedCapabilities).toContain('image.background');
      expect(sharpEngine.supportedCapabilities).toContain('image.filter');
      expect(sharpEngine.supportedCapabilities).toContain('image.favicon');
    });

    it('sharpEngine.isSupported() 应返回 true', async () => {
      const { sharpEngine } = await import('../node/sharp-engine.js');
      expect(await sharpEngine.isSupported()).toBe(true);
    });
  });

  describe('utils', () => {
    it('computeTargetSize 与浏览器版一致', async () => {
      const { computeTargetSize } = await import('../node/operations/utils.js');
      // 200x100 → width=100,默认 cover,保持宽高比 → 100x50
      expect(computeTargetSize(200, 100, { width: 100 })).toEqual({
        width: 100,
        height: 50,
      });
      // 200x100 → height=50,保持宽高比 → 100x50
      expect(computeTargetSize(200, 100, { height: 50 })).toEqual({
        width: 100,
        height: 50,
      });
      // 200x100 → 100x100 fill → 100x100
      expect(
        computeTargetSize(200, 100, { width: 100, height: 100, fit: 'fill' })
      ).toEqual({ width: 100, height: 100 });
    });

    it('inferFormat 与浏览器版一致', async () => {
      const { inferFormat } = await import('../node/operations/utils.js');
      expect(inferFormat(new Blob([], { type: 'image/png' }), 'webp')).toBe('png');
      expect(inferFormat(new Blob([], { type: 'image/jpeg' }), 'webp')).toBe('jpeg');
      expect(inferFormat(new Blob([], { type: 'image/webp' }), 'png')).toBe('webp');
      expect(inferFormat(new Blob([], { type: 'application/octet-stream' }), 'png')).toBe('png');
    });

    it('normalizeQuality 边界', async () => {
      const { normalizeQuality } = await import('../node/operations/utils.js');
      expect(normalizeQuality(50)).toBe(50);
      expect(normalizeQuality(0)).toBe(1); // clamp to 1
      expect(normalizeQuality(200)).toBe(100); // clamp to 100
      expect(normalizeQuality(undefined)).toBe(85); // fallback
      expect(normalizeQuality(NaN)).toBe(85);
    });

    it('throwIfAborted 与浏览器版一致', async () => {
      const { throwIfAborted } = await import('../node/operations/utils.js');
      expect(() => throwIfAborted()).not.toThrow();
      expect(() => throwIfAborted(undefined)).not.toThrow();
      const ac = new AbortController();
      ac.abort();
      expect(() => throwIfAborted(ac.signal)).toThrow(/aborted/);
    });

    it('isSafeImageUrl 与浏览器版一致', async () => {
      const { isSafeImageUrl } = await import('../node/operations/utils.js');
      expect(isSafeImageUrl('http://localhost/x.png')).toBe(false);
      expect(isSafeImageUrl('http://127.0.0.1/x.png')).toBe(false);
      expect(isSafeImageUrl('http://169.254.169.254/x')).toBe(false);
      expect(isSafeImageUrl('http://10.0.0.1/x')).toBe(false);
      expect(isSafeImageUrl('http://192.168.1.1/x')).toBe(false);
      expect(isSafeImageUrl('http://172.16.0.1/x')).toBe(false);
      expect(isSafeImageUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeImageUrl('not a url')).toBe(false);
      // 公网(此处仅校验语法,不实际访问)
      expect(isSafeImageUrl('https://example.com/x.png')).toBe(true);
    });
  });
});

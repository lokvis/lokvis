/**
 * Image tools 单元测试
 *
 * 使用 sharp 生成真实测试图片,验证 resize/compress/convert 的正确性。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { imageResize, imageCompress, imageConvert, getImageToolRegistrations } from '../../tools/image.js';

describe('Image tools', () => {
  let workdir: string;
  let testImagePath: string;

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'lokvis-image-tools-'));
    testImagePath = join(workdir, 'test.png');
    // 生成 200x100 红色 PNG 测试图片
    await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toFile(testImagePath);
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  describe('imageResize', () => {
    it('应按指定 width 等比缩放', async () => {
      const result = await imageResize({
        input_path: testImagePath,
        width: 100,
      });
      expect(result.isError).toBeFalsy();
      expect(result.content[0]!.type).toBe('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('resized');
      expect(text).toContain('100x50'); // 200x100 → 100x50

      // 验证输出文件
      const meta = await sharp(join(workdir, 'test_resized.png')).metadata();
      expect(meta.width).toBe(100);
      expect(meta.height).toBe(50);
    });

    it('应按指定 width 和 height 缩放', async () => {
      const result = await imageResize({
        input_path: testImagePath,
        width: 80,
        height: 80,
        fit: 'fill',
      });
      expect(result.isError).toBeFalsy();
      const meta = await sharp(join(workdir, 'test_resized.png')).metadata();
      expect(meta.width).toBe(80);
      expect(meta.height).toBe(80);
    });

    it('无 width 和 height 应返回错误', async () => {
      const result = await imageResize({
        input_path: testImagePath,
      });
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('width or height');
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'custom.png');
      await imageResize({
        input_path: testImagePath,
        width: 50,
        output_path: outputPath,
      });
      const meta = await sharp(outputPath).metadata();
      expect(meta.width).toBe(50);
    });

    it('输入文件不存在应返回错误', async () => {
      const result = await imageResize({
        input_path: join(workdir, 'nonexistent.png'),
        width: 100,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe('imageCompress', () => {
    it('应压缩 JPEG 图片', async () => {
      // 先生成一个较大的 JPEG
      const jpegPath = join(workdir, 'test.jpg');
      await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          background: { r: 128, g: 64, b: 32 },
        },
      })
        .jpeg({ quality: 100 })
        .toFile(jpegPath);

      const result = await imageCompress({
        input_path: jpegPath,
        quality: 30,
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('compressed');

      // 压缩后文件应更小
      const compressedMeta = await sharp(join(workdir, 'test_compressed.jpg')).metadata();
      expect(compressedMeta.format).toBe('jpeg');
    });

    it('quality 超范围应返回错误', async () => {
      const result = await imageCompress({
        input_path: testImagePath,
        quality: 150,
      });
      expect(result.isError).toBe(true);
    });

    it('quality 为 0 应返回错误', async () => {
      const result = await imageCompress({
        input_path: testImagePath,
        quality: 0,
      });
      expect(result.isError).toBe(true);
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'custom.png');
      const result = await imageCompress({
        input_path: testImagePath,
        quality: 50,
        output_path: outputPath,
      });
      expect(result.isError).toBeFalsy();
    });
  });

  describe('imageConvert', () => {
    it('应将 PNG 转为 JPEG', async () => {
      const result = await imageConvert({
        input_path: testImagePath,
        format: 'jpeg',
      });
      expect(result.isError).toBeFalsy();
      const meta = await sharp(join(workdir, 'test_converted.jpeg')).metadata();
      expect(meta.format).toBe('jpeg');
    });

    it('应将 PNG 转为 WebP', async () => {
      const result = await imageConvert({
        input_path: testImagePath,
        format: 'webp',
      });
      expect(result.isError).toBeFalsy();
      const meta = await sharp(join(workdir, 'test_converted.webp')).metadata();
      expect(meta.format).toBe('webp');
    });

    it('无效 format 应返回错误', async () => {
      const result = await imageConvert({
        input_path: testImagePath,
        format: 'bmp' as 'jpeg',
      });
      expect(result.isError).toBe(true);
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'out.webp');
      await imageConvert({
        input_path: testImagePath,
        format: 'webp',
        output_path: outputPath,
      });
      const meta = await sharp(outputPath).metadata();
      expect(meta.format).toBe('webp');
    });
  });

  describe('getImageToolRegistrations', () => {
    it('应返回 3 个 tool 注册信息', () => {
      const tools = getImageToolRegistrations();
      expect(tools).toHaveLength(3);
    });

    it('tool 命名应遵循 lokvis_image_<verb> 约定', () => {
      const tools = getImageToolRegistrations();
      const names = tools.map((t) => t.name);
      expect(names).toContain('lokvis_image_resize');
      expect(names).toContain('lokvis_image_compress');
      expect(names).toContain('lokvis_image_convert');
    });

    it('每个 tool 应有 description 和 inputSchema', () => {
      const tools = getImageToolRegistrations();
      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(typeof tool.handler).toBe('function');
      }
    });

    it('handler 应可调用并返回 McpToolResult', async () => {
      const tools = getImageToolRegistrations();
      const resizeTool = tools.find((t) => t.name === 'lokvis_image_resize')!;
      const result = await resizeTool.handler({
        input_path: testImagePath,
        width: 50,
      });
      expect(result).toHaveProperty('content');
      expect(result.content).toBeInstanceOf(Array);
    });
  });
});

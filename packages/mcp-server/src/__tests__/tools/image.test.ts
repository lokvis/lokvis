/**
 * Image tools 单元测试
 *
 * TD-1.1 改造后:image tool handler 经 runtime.run() 走完整 capability 系统
 * (CapabilityRegistry.resolve → createBlobCapabilityImpl → engine operation)。
 *
 * 测试策略:
 * - 创建真实 Lokvis Runtime + 安装 imageToolsPluginNode(sharp engine)
 * - 使用 sharp 生成真实测试图片,验证 resize/compress/convert/crop/watermark 的正确性
 * - 验证 getImageToolRegistrations(runtime) 返回 5 个 tool 注册
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createLokvis } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';
import { imageToolsPluginNode } from '@lokvis/plugin-image/node';
import {
  imageResize,
  imageCompress,
  imageConvert,
  imageCrop,
  imageWatermark,
  getImageToolRegistrations,
} from '../../tools/image.js';

describe('Image tools', () => {
  let workdir: string;
  let testImagePath: string;
  let runtime: LokvisRuntime;

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

    // 创建真实 runtime + 安装 imageToolsPluginNode(sharp engine)
    runtime = await createLokvis({ enableOpfs: false, enableIndexedDB: false });
    await runtime.installPlugin(await imageToolsPluginNode());
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.dispose?.();
    }
    if (workdir) {
      await rm(workdir, { recursive: true, force: true });
    }
  });

  describe('imageResize', () => {
    it('应按指定 width 等比缩放', async () => {
      const result = await imageResize(
        { input_path: testImagePath, width: 100 },
        runtime
      );
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
      const result = await imageResize(
        { input_path: testImagePath, width: 80, height: 80, fit: 'fill' },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const meta = await sharp(join(workdir, 'test_resized.png')).metadata();
      expect(meta.width).toBe(80);
      expect(meta.height).toBe(80);
    });

    it('无 width 和 height 应返回错误', async () => {
      const result = await imageResize({ input_path: testImagePath }, runtime);
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('width or height');
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'custom.png');
      await imageResize(
        { input_path: testImagePath, width: 50, output_path: outputPath },
        runtime
      );
      const meta = await sharp(outputPath).metadata();
      expect(meta.width).toBe(50);
    });

    it('输入文件不存在应返回错误', async () => {
      const result = await imageResize(
        { input_path: join(workdir, 'nonexistent.png'), width: 100 },
        runtime
      );
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

      const result = await imageCompress(
        { input_path: jpegPath, quality: 30 },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('compressed');

      // 压缩后文件应更小
      const compressedMeta = await sharp(join(workdir, 'test_compressed.jpg')).metadata();
      expect(compressedMeta.format).toBe('jpeg');
    });

    it('quality 超范围应返回错误', async () => {
      const result = await imageCompress(
        { input_path: testImagePath, quality: 150 },
        runtime
      );
      expect(result.isError).toBe(true);
    });

    it('quality 为 0 应返回错误', async () => {
      const result = await imageCompress(
        { input_path: testImagePath, quality: 0 },
        runtime
      );
      expect(result.isError).toBe(true);
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'custom.png');
      const result = await imageCompress(
        { input_path: testImagePath, quality: 50, output_path: outputPath },
        runtime
      );
      expect(result.isError).toBeFalsy();
    });
  });

  describe('imageConvert', () => {
    it('应将 PNG 转为 JPEG', async () => {
      const result = await imageConvert(
        { input_path: testImagePath, format: 'jpeg' },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const meta = await sharp(join(workdir, 'test_converted.jpeg')).metadata();
      expect(meta.format).toBe('jpeg');
    });

    it('应将 PNG 转为 WebP', async () => {
      const result = await imageConvert(
        { input_path: testImagePath, format: 'webp' },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const meta = await sharp(join(workdir, 'test_converted.webp')).metadata();
      expect(meta.format).toBe('webp');
    });

    it('无效 format 应返回错误', async () => {
      const result = await imageConvert(
        { input_path: testImagePath, format: 'bmp' as 'jpeg' },
        runtime
      );
      expect(result.isError).toBe(true);
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'out.webp');
      await imageConvert(
        { input_path: testImagePath, format: 'webp', output_path: outputPath },
        runtime
      );
      const meta = await sharp(outputPath).metadata();
      expect(meta.format).toBe('webp');
    });
  });

  describe('imageCrop', () => {
    it('应裁剪指定矩形区域', async () => {
      const result = await imageCrop(
        { input_path: testImagePath, x: 10, y: 10, width: 100, height: 50 },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('cropped');
      expect(text).toContain('(10, 10) 100x50');

      const meta = await sharp(join(workdir, 'test_cropped.png')).metadata();
      expect(meta.width).toBe(100);
      expect(meta.height).toBe(50);
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'cropped.png');
      const result = await imageCrop(
        {
          input_path: testImagePath,
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          output_path: outputPath,
        },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const meta = await sharp(outputPath).metadata();
      expect(meta.width).toBe(50);
      expect(meta.height).toBe(50);
    });

    it('width/height 非正数应返回错误', async () => {
      const result = await imageCrop(
        { input_path: testImagePath, x: 0, y: 0, width: 0, height: 50 },
        runtime
      );
      expect(result.isError).toBe(true);
    });

    it('x/y/width/height 非数字应返回错误', async () => {
      const result = await imageCrop(
        {
          input_path: testImagePath,
          x: '10' as unknown as number,
          y: 10,
          width: 100,
          height: 50,
        },
        runtime
      );
      expect(result.isError).toBe(true);
    });
  });

  describe('imageWatermark', () => {
    it('应添加文字水印', async () => {
      const result = await imageWatermark(
        {
          input_path: testImagePath,
          text: 'Lokvis',
          position: 'bottom-right',
        },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('watermarked');
      expect(text).toContain('text("Lokvis")');

      // 验证输出文件存在且为有效 PNG
      const meta = await sharp(join(workdir, 'test_watermarked.png')).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(100);
    });

    it('应支持自定义位置和透明度', async () => {
      const result = await imageWatermark(
        {
          input_path: testImagePath,
          text: '© 2026',
          position: 'center',
          opacity: 0.5,
          fontSize: 16,
          color: '#000000',
        },
        runtime
      );
      expect(result.isError).toBeFalsy();
    });

    it('应支持 tile 位置', async () => {
      const result = await imageWatermark(
        {
          input_path: testImagePath,
          text: 'DRAFT',
          position: 'tile',
        },
        runtime
      );
      expect(result.isError).toBeFalsy();
    });

    it('无 text 和 image 应返回错误', async () => {
      const result = await imageWatermark(
        { input_path: testImagePath },
        runtime
      );
      expect(result.isError).toBe(true);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('text or image');
    });

    it('应支持自定义 output_path', async () => {
      const outputPath = join(workdir, 'wm.png');
      const result = await imageWatermark(
        {
          input_path: testImagePath,
          text: 'WM',
          output_path: outputPath,
        },
        runtime
      );
      expect(result.isError).toBeFalsy();
      const meta = await sharp(outputPath).metadata();
      expect(meta.format).toBe('png');
    });
  });

  describe('getImageToolRegistrations', () => {
    it('应返回 10 个 tool 注册信息', () => {
      const tools = getImageToolRegistrations(runtime);
      expect(tools).toHaveLength(10);
    });

    it('tool 命名应遵循 lokvis_image_<verb> 约定', () => {
      const tools = getImageToolRegistrations(runtime);
      const names = tools.map((t) => t.name);
      expect(names).toContain('lokvis_image_resize');
      expect(names).toContain('lokvis_image_compress');
      expect(names).toContain('lokvis_image_convert');
      expect(names).toContain('lokvis_image_crop');
      expect(names).toContain('lokvis_image_watermark');
      expect(names).toContain('lokvis_image_rotate');
      expect(names).toContain('lokvis_image_flip');
      expect(names).toContain('lokvis_image_background');
      expect(names).toContain('lokvis_image_filter');
      expect(names).toContain('lokvis_image_favicon');
    });

    it('每个 tool 应有 description 和 inputSchema', () => {
      const tools = getImageToolRegistrations(runtime);
      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(typeof tool.handler).toBe('function');
      }
    });

    it('handler 应可调用并返回 McpToolResult', async () => {
      const tools = getImageToolRegistrations(runtime);
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

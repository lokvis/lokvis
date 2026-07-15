/**
 * plugin-grayscale —— 教学用最小示例插件(W18.3)
 *
 * 目标:用最少的代码展示一个完整 Lokvis 插件的结构,让读者能在一屏内
 * 看懂 definePlugin + createBlobCapabilityImpl + 自定义 operation 三者如何
 * 组合成一个可被 Runtime 加载的插件。
 *
 * 能力:注册 `image.grayscale`(image → image),把彩色图片转为灰度。
 *
 * 与官方 @lokvis/plugin-image 的区别:
 * - 官方插件把 Blob↔Blob 操作下沉到 @lokvis/engine-image(纯函数),
 *   插件层只做 Asset↔Blob 粘合(五层架构约定)
 * - 本教学插件把灰度化逻辑直接写在 operation 里,自包含、易读,
 *   适合教学;生产插件应遵循官方的分层模式
 *
 * 灰度算法:luminance(亮度法) gray = 0.299R + 0.587G + 0.114B
 * (人眼对绿色更敏感,加权平均比简单平均更符合视觉感知)
 */
import { definePlugin, createBlobCapabilityImpl } from '@lokvis/plugin-sdk';
import type { Capability, PluginContext } from '@lokvis/schema';

// ─── 插件常量 ─────────────────────────────────────────────────────

export const PLUGIN_NAME = 'lokvis-example-grayscale';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'canvas-teaching';

// ─── 能力声明 ─────────────────────────────────────────────────────

/**
 * `image.grayscale` 能力声明。
 *
 * 这是一个纯数据契约(不含实现),任何层都可引用。
 * params.algorithm 让用户可选灰度算法(教学用:展示如何声明参数)。
 */
const GRAYSCALE_CAPABILITY: Capability = {
  name: 'image.grayscale',
  description: 'Convert image to grayscale (luminance / average / lightness)',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'algorithm',
      type: 'enum',
      description: 'Grayscale algorithm',
      required: false,
      default: 'luminance',
      values: ['luminance', 'average', 'lightness'],
    },
  ],
  performance: 'fast',
  batchable: true,
};

// ─── Blob↔Blob 操作(教学用:自包含,不依赖 engine 包)───────────────

export type GrayscaleAlgorithm = 'luminance' | 'average' | 'lightness';

/**
 * 把单个 RGBA 像素转为灰度值。
 *
 * 三种算法:
 * - luminance:0.299R + 0.587G + 0.114B(ITU-R BT.601,符合人眼感知)
 * - average:(R + G + B) / 3(简单平均,数学直观)
 * - lightness:(max(R,G,B) + min(R,G,B)) / 2(HSL 亮度)
 */
function toGray(
  r: number,
  g: number,
  b: number,
  algorithm: GrayscaleAlgorithm
): number {
  switch (algorithm) {
    case 'average':
      return (r + g + b) / 3;
    case 'lightness':
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    case 'luminance':
    default:
      return 0.299 * r + 0.587 * g + 0.114 * b;
  }
}

/**
 * 灰度化 operation:Blob → Blob。
 *
 * 这是插件的核心 —— 接收输入 Blob,返回输出 Blob。
 * createBlobCapabilityImpl 工厂会负责 Asset↔Blob 转换与元数据派生,
 * 插件只需专注这一步。
 *
 * 实现:decode → drawImage → getImageData → 逐像素灰度 → putImageData → encode
 * (教学注释:生产代码应把这个函数放到 engine 包,插件只做粘合)
 *
 * 浏览器环境依赖:createImageBitmap / Canvas / CanvasRenderingContext2D
 * Node 环境不可用(需走 sharp 路径,见 @lokvis/plugin-image/node)
 */
export async function grayscale(
  blob: Blob,
  params: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Blob> {
  const algorithm = (params.algorithm as GrayscaleAlgorithm) ?? 'luminance';

  // 1. 解码:Blob → ImageBitmap(浏览器原生,零依赖)
  const bitmap = await createImageBitmap(blob);
  if (signal?.aborted) {
    bitmap.close?.();
    throw new DOMException('Operation aborted', 'AbortError');
  }

  const { width, height } = bitmap;

  // 2. 绘制到 canvas(用于读写像素)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Failed to get 2D context');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  if (signal?.aborted) {
    throw new DOMException('Operation aborted', 'AbortError');
  }

  // 3. 逐像素灰度化
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = toGray(data[i]!, data[i + 1]!, data[i + 2]!, algorithm);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    // data[i + 3] 是 alpha,保持不变
  }
  ctx.putImageData(imageData, 0, 0);

  // 4. 编码:canvas → Blob(保持原格式,png 回退)
  const mimeType = blob.type || 'image/png';
  const outputBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => {
        if (out) resolve(out);
        else reject(new Error('canvas.toBlob returned null'));
      },
      mimeType
    );
  });

  return outputBlob;
}

// ─── 插件定义 ─────────────────────────────────────────────────────

/**
 * 构造灰度化能力实现数组(参考官方插件的 buildXxx 模式)。
 *
 * 教学插件只有一个能力,所以数组只有 1 个元素;
 * 官方插件(如 plugin-image)用 entries 数组 + map 批量构造。
 */
export function buildGrayscaleCapabilityImplementations(ctx: PluginContext) {
  return [
    createBlobCapabilityImpl(
      {
        capability: 'image.grayscale',
        engine: PLUGIN_ENGINE,
        outputType: 'image',
        operation: grayscale,
        // 教学插件不是 stub(真实实现);官方插件会检测 engine.version.includes('stub')
        isStub: false,
      },
      ctx
    ),
  ];
}

/**
 * 创建 plugin-grayscale 插件对象。
 *
 * 用法:
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { grayscalePlugin } from '@lokvis/example-plugin-grayscale';
 *
 * const lokvis = await createLokvis({
 *   plugins: [grayscalePlugin()],
 * });
 * ```
 */
export function grayscalePlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Example plugin: convert image to grayscale via canvas pixel manipulation (teaching use)',
      capabilities: [GRAYSCALE_CAPABILITY],
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildGrayscaleCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log(
        'info',
        `Registered ${impls.length} grayscale capability (${PLUGIN_ENGINE} engine)`
      );
    }
  );
}

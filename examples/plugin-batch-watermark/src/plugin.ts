/**
 * plugin-batch-watermark —— N→1 merge 形态教学插件(E1)
 *
 * 目标:展示 `createMergeCapabilityImpl` 工厂的完整用法,与 plugin-grayscale
 * 的 1→1 single 形态互补。读者可以对照两个示例,理解 Lokvis 三种 Asset-flow
 * 形态(1→1 / N→1 / 1→N)中的前两种。
 *
 * 能力:注册 `image.batch-watermark`(image[] → image),把多张图片:
 *   1. 逐张盖上文字水印(可选位置/字号/不透明度)
 *   2. 拼接成一张 contact sheet(网格布局,自动算列数)
 *
 * 与官方 @lokvis/plugin-image 的区别:
 * - 官方插件把 Blob↔Blob 操作下沉到 @lokvis/engine-image(纯函数),
 *   插件层只做 Asset↔Blob 粘合(五层架构约定)
 * - 本教学插件把 watermark + stitch 逻辑直接写在 operation 里,自包含、易读,
 *   适合教学;生产插件应遵循官方的分层模式
 *
 * 与 plugin-grayscale 的形态对比:
 * - plugin-grayscale:`createBlobCapabilityImpl` — 1→1(单输入 → 单输出)
 * - plugin-batch-watermark:`createMergeCapabilityImpl` — N→1(多输入 → 单输出)
 *   operation 签名是 `(blobs: Blob[], params) => Promise<Blob>`,
 *   `deriveMetadata` 必填(merge 无单一 source,无合理默认元数据)。
 */
import {
  definePlugin,
  createMergeCapabilityImpl,
} from '@lokvis/plugin-sdk';
import type {
  AssetMetadata,
  Capability,
  PluginContext,
} from '@lokvis/schema';

// ─── 插件常量 ─────────────────────────────────────────────────────

export const PLUGIN_NAME = 'lokvis-example-batch-watermark';
export const PLUGIN_VERSION = '0.1.0';
export const PLUGIN_ENGINE = 'canvas-merge-teaching';

// ─── 能力声明 ─────────────────────────────────────────────────────

/**
 * `image.batch-watermark` 能力声明。
 *
 * 这是一个纯数据契约(不含实现)。inputTypes 为 `image`(允许多个),
 * outputTypes 为 `image`(单张 contact sheet)。
 */
const BATCH_WATERMARK_CAPABILITY: Capability = {
  name: 'image.batch-watermark',
  description:
    'Stamp a text watermark onto each input image and stitch them into a single contact sheet (N→1 merge)',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'text',
      type: 'string',
      description: 'Watermark text (stamped on every input image)',
      required: false,
      default: '© Lokvis',
    },
    {
      name: 'position',
      type: 'enum',
      description: 'Watermark anchor position',
      required: false,
      default: 'bottom-right',
      values: [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'center',
      ],
    },
    {
      name: 'fontSize',
      type: 'number',
      description: 'Watermark font size in pixels (relative to source width)',
      required: false,
      default: 24,
    },
    {
      name: 'opacity',
      type: 'number',
      description: 'Watermark opacity (0–1)',
      required: false,
      default: 0.6,
    },
    {
      name: 'columns',
      type: 'number',
      description:
        'Contact sheet columns (auto-computed from input count if omitted)',
      required: false,
    },
    {
      name: 'padding',
      type: 'number',
      description: 'Padding between thumbnails in pixels',
      required: false,
      default: 8,
    },
  ],
  performance: 'slow',
  batchable: false, // merge 形态本身就是"批处理",不再外层 batch
};

// ─── Blob↔Blob 操作(教学用:自包含,不依赖 engine 包)───────────────

export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface BatchWatermarkParams {
  text?: string;
  position?: WatermarkPosition;
  fontSize?: number;
  opacity?: number;
  columns?: number;
  padding?: number;
}

/**
 * 给单张图片盖文字水印。
 *
 * 实现:decode → drawImage → fillText(with globalAlpha)→ encode。
 * 返回带水印的 Blob(尺寸与原图一致)。
 */
async function stampWatermark(
  blob: Blob,
  params: Required<
    Pick<BatchWatermarkParams, 'text' | 'position' | 'fontSize' | 'opacity'>
  >
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Failed to get 2D context for watermark stamping');
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  // 绘制水印
  const { text, position, fontSize, opacity } = params;
  ctx.globalAlpha = opacity;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(1, Math.floor(fontSize / 12));
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;
  const margin = Math.max(4, Math.floor(fontSize / 6));

  let x: number;
  let y: number;
  switch (position) {
    case 'top-left':
      x = margin;
      y = margin + textHeight;
      break;
    case 'top-right':
      x = width - textWidth - margin;
      y = margin + textHeight;
      break;
    case 'bottom-left':
      x = margin;
      y = height - margin;
      break;
    case 'center':
      x = (width - textWidth) / 2;
      y = (height + textHeight) / 2;
      break;
    case 'bottom-right':
    default:
      x = width - textWidth - margin;
      y = height - margin;
      break;
  }
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;

  const mimeType = blob.type || 'image/png';
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => {
        if (out) resolve(out);
        else reject(new Error('canvas.toBlob returned null (watermark)'));
      },
      mimeType
    );
  });
}

/**
 * 把多张图片拼接成 contact sheet(网格布局)。
 *
 * 列数优先用 params.columns,否则按 sqrt(n) 向上取整。
 * 每个缩略图按 cells 的最大宽/高对齐(不拉伸,居中绘制)。
 */
async function stitchContactSheet(
  blobs: Blob[],
  params: Required<Pick<BatchWatermarkParams, 'columns' | 'padding'>>
): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error('stitchContactSheet requires at least one input blob');
  }

  const bitmaps = await Promise.all(blobs.map((b) => createImageBitmap(b)));

  try {
    const { columns: explicitColumns, padding } = params;
    const n = bitmaps.length;
    const columns =
      explicitColumns > 0
        ? explicitColumns
        : Math.max(1, Math.ceil(Math.sqrt(n)));
    const rows = Math.ceil(n / columns);

    // 统一 cell 尺寸(取所有 bitmap 的最大宽高,保证不拉伸)
    let cellW = 0;
    let cellH = 0;
    for (const bm of bitmaps) {
      if (bm.width > cellW) cellW = bm.width;
      if (bm.height > cellH) cellH = bm.height;
    }
    if (cellW === 0 || cellH === 0) {
      throw new Error('Invalid bitmap dimensions in stitchContactSheet');
    }

    const sheetW = columns * cellW + (columns + 1) * padding;
    const sheetH = rows * cellH + (rows + 1) * padding;

    const canvas = document.createElement('canvas');
    canvas.width = sheetW;
    canvas.height = sheetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context for contact sheet');
    }

    // 白色背景(便于查看)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW, sheetH);

    bitmaps.forEach((bm, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const cellX = padding + col * (cellW + padding);
      const cellY = padding + row * (cellH + padding);
      // 居中绘制
      const offsetX = cellX + (cellW - bm.width) / 2;
      const offsetY = cellY + (cellH - bm.height) / 2;
      ctx.drawImage(bm, offsetX, offsetY);
    });

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (out) => {
          if (out) resolve(out);
          else
            reject(
              new Error('canvas.toBlob returned null (contact sheet)')
            );
        },
        'image/png'
      );
    });
  } finally {
    for (const bm of bitmaps) bm.close?.();
  }
}

/**
 * batch-watermark operation:Blob[] → Blob。
 *
 * 这是 N→1 merge 形态的核心 —— 接收多个输入 Blob,返回单个输出 Blob。
 * `createMergeCapabilityImpl` 工厂会负责 Asset↔Blob 转换,
 * 插件只需专注这一步。
 *
 * 实现:① 逐张盖水印 → ② 拼接 contact sheet
 * (教学注释:生产代码应把这两步分别下沉到 engine 包,
 *  插件只做粘合;此处为可读性合并到一个函数)
 *
 * 浏览器环境依赖:createImageBitmap / Canvas / CanvasRenderingContext2D
 * Node 环境不可用(需走 sharp 路径,见 @lokvis/plugin-image/node)
 */
export async function batchWatermark(
  blobs: Blob[],
  params: Record<string, unknown>
): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error('batchWatermark requires at least one input blob');
  }

  const text = (params.text as string | undefined) ?? '© Lokvis';
  const position =
    (params.position as WatermarkPosition | undefined) ?? 'bottom-right';
  const fontSize = (params.fontSize as number | undefined) ?? 24;
  const opacity = (params.opacity as number | undefined) ?? 0.6;
  const columns = (params.columns as number | undefined) ?? 0;
  const padding = (params.padding as number | undefined) ?? 8;

  // 1. 逐张盖水印
  const stamped: Blob[] = [];
  for (const blob of blobs) {
    const out = await stampWatermark(blob, {
      text,
      position,
      fontSize,
      opacity,
    });
    stamped.push(out);
  }

  // 2. 拼接 contact sheet
  return stitchContactSheet(stamped, { columns, padding });
}

// ─── 元数据派生 ───────────────────────────────────────────────────

/**
 * merge 形态的 `deriveMetadata` 必填(无单一 source,无合理默认)。
 *
 * 本实现从输出 Blob 取 mimeType/size/format;dimensions 因为 contact sheet
 * 是新生成的,无法从 source 传播,这里设为 undefined(由上层 UI 在
 * createAsset 后通过 MetadataReader 补充,或留空)。
 */
function deriveContactSheetMetadata(outBlob: Blob): AssetMetadata {
  const mimeType = outBlob.type || 'image/png';
  const format = mimeType.split('/')[1] ?? 'png';
  return {
    mimeType,
    size: outBlob.size,
    format,
  };
}

// ─── 插件定义 ─────────────────────────────────────────────────────

/**
 * 构造 batch-watermark 能力实现数组(参考官方插件的 buildXxx 模式)。
 *
 * 教学插件只有一个能力,所以数组只有 1 个元素;
 * 与 plugin-grayscale 不同,这里用 `createMergeCapabilityImpl`(N→1),
 * 而非 `createBlobCapabilityImpl`(1→1)。
 */
export function buildBatchWatermarkCapabilityImplementations(
  ctx: PluginContext
) {
  return [
    createMergeCapabilityImpl(
      {
        capability: 'image.batch-watermark',
        engine: PLUGIN_ENGINE,
        outputType: 'image',
        operation: batchWatermark,
        // 教学插件不是 stub(真实实现);官方插件会检测 engine.version.includes('stub')
        isStub: false,
        deriveMetadata: deriveContactSheetMetadata,
      },
      ctx
    ),
  ];
}

/**
 * 创建 plugin-batch-watermark 插件对象。
 *
 * 用法:
 * ```ts
 * import { createLokvis } from '@lokvis/sdk';
 * import { batchWatermarkPlugin } from '@lokvis/example-plugin-batch-watermark';
 *
 * const lokvis = await createLokvis({
 *   plugins: [batchWatermarkPlugin()],
 * });
 * ```
 */
export function batchWatermarkPlugin() {
  return definePlugin(
    {
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
      description:
        'Example plugin: stamp watermark on each input image and merge into a contact sheet (N→1, teaching use)',
      capabilities: [BATCH_WATERMARK_CAPABILITY],
      engine: PLUGIN_ENGINE,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      const impls = buildBatchWatermarkCapabilityImplementations(ctx);
      for (const impl of impls) {
        ctx.registerCapability(impl);
      }
      ctx.log(
        'info',
        `Registered ${impls.length} batch-watermark capability (${PLUGIN_ENGINE} engine, N→1 merge)`
      );
    }
  );
}

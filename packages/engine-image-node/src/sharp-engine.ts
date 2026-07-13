/**
 * Sharp 图像引擎(Node.js)
 *
 * 基于 sharp(libvips)实现,与浏览器 canvas 引擎(@lokvis/engine-image)对齐的
 * 5 个核心操作:resize / compress / convert / crop / watermark。
 *
 * 设计原则:
 * - 操作函数签名与 engine-image 完全一致(Blob → Blob + Record<string,any> + AbortSignal)
 * - 不实现 ImageEngineAdapter(decode/encode 与浏览器 API 耦合),
 *   只暴露 sharpEngine 描述符 + 操作函数集
 * - 不修改 engine-image,保持浏览器引擎纯净
 *
 * 与浏览器 canvas 的差异:
 * - sharp 内置 libvips,直接处理 Buffer,无 Canvas 中间态
 * - 字体水印使用 sharp 内置 SVG composite(text via SVG <text>),无需 canvas 2D
 * - 图片水印支持 data URL / http(s) URL,SSRF 校验同 engine-image
 *
 * 参考:docs/reports/architecture-deep-diagnostic-20260712.md §M2.2
 */

import type { NodeImageEngineDescriptor } from './types.js';

/** Sharp 引擎版本(随包版本) */
export const SHARP_ENGINE_VERSION = '0.1.0';

/**
 * Sharp 引擎描述符。
 *
 * version 不含 'stub',表示真实可用实现(AGENTS.md stub 约定)。
 */
export const sharpEngine: NodeImageEngineDescriptor = {
  name: 'sharp',
  version: SHARP_ENGINE_VERSION,
  supportedCapabilities: [
    'image.resize',
    'image.compress',
    'image.convert',
    'image.crop',
    'image.watermark',
    // 以下能力在 Node 引擎中未实现(rotate/flip/background/filter),
    // plugin-image 会回退到 stub 实现并给出明确错误提示
  ],

  async isSupported() {
    try {
      // dynamic import 探测 sharp 是否可用(可能因平台/架构缺失 prebuilt binary)
      const sharp = (await import('sharp')).default;
      // 简单探测:能构造一个 1x1 的 pipeline 即视为可用
      sharp({
        create: { width: 1, height: 1, channels: 3, background: '#000' },
      });
      return true;
    } catch {
      return false;
    }
  },
};

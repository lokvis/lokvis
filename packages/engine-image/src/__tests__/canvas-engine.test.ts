/**
 * canvas-engine encode 格式校验单元测试
 *
 * 验证当传入不支持的格式(如 'ico')时,encode 抛出明确错误,
 * 而非静默回退到 PNG(静默回退 bug 修复)。
 *
 * 背景:capability 声明(image.generated.ts)的 format enum 包含 'ico',
 * schema 校验通过,但 canvasEngine 的 MIME_BY_FORMAT 没有 'ico'。
 * 旧实现 `MIME_BY_FORMAT[format] ?? 'image/png'` 会静默产出 PNG。
 *
 * 不依赖真实 Canvas:用 fake canvas 模拟 toBlob 行为,使"静默回退"
 * 能真正发生(而非因 canvas 缺失抛错干扰断言)。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { canvasEngine } from '../canvas-engine.js';

// encode 内部用 `canvas instanceof OffscreenCanvas` 分支,Node 测试环境
// 无 OffscreenCanvas 全局会抛 ReferenceError。此处 stub 一个空类,
// 使 instanceof 检查可正常求值(fake canvas 不是其实例 → 走 toBlob 路径)。
beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas =
      class OffscreenCanvas {};
  }
});

/** fake canvas:模拟 HTMLCanvasElement.toBlob,按请求 MIME 产出 Blob */
function createFakeCanvas(): unknown {
  return {
    toBlob: (callback: (blob: Blob | null) => void, mime: string, _quality: number) => {
      callback(new Blob([new Uint8Array([0])], { type: mime }));
    },
  };
}

describe('canvasEngine.encode 格式校验', () => {
  it('传入不支持的格式(ico)应抛出明确错误,而非静默回退 PNG', async () => {
    const fakeCanvas = createFakeCanvas();
    await expect(
      canvasEngine.encode(
        fakeCanvas as HTMLCanvasElement,
        'ico' as never,
        90
      )
    ).rejects.toThrow(/Unsupported image format/);
  });

  it('错误消息应包含不支持的格式名并列出所有支持的格式', async () => {
    const fakeCanvas = createFakeCanvas();
    await expect(
      canvasEngine.encode(
        fakeCanvas as HTMLCanvasElement,
        'ico' as never,
        90
      )
    ).rejects.toThrow(/ico.*png.*jpeg.*webp.*avif.*gif/);
  });
});

describe('canvasEngine.encode 静默回退检测', () => {
  /** fake canvas:模拟浏览器无 AVIF 编码器时 toBlob 静默回退 PNG 的行为 */
  function createFallbackCanvas(): unknown {
    return {
      toBlob: (callback: (blob: Blob | null) => void, _mime: string, _quality: number) => {
        // 无论请求什么 MIME,都产出 PNG(浏览器回退行为)
        callback(new Blob([new Uint8Array([0])], { type: 'image/png' }));
      },
    };
  }

  it('请求 avif 但浏览器回退 PNG 时应抛错,而非静默返回 PNG', async () => {
    const fallbackCanvas = createFallbackCanvas();
    await expect(
      canvasEngine.encode(fallbackCanvas as HTMLCanvasElement, 'avif', 80)
    ).rejects.toThrow(/does not support encoding 'avif'/);
  });

  it('回退错误消息应指明实际产出的格式', async () => {
    const fallbackCanvas = createFallbackCanvas();
    await expect(
      canvasEngine.encode(fallbackCanvas as HTMLCanvasElement, 'avif', 80)
    ).rejects.toThrow(/image\/png/);
  });

  it('请求与产出一致时(webp)应正常返回', async () => {
    const fakeCanvas = createFakeCanvas();
    const blob = await canvasEngine.encode(fakeCanvas as HTMLCanvasElement, 'webp', 90);
    expect(blob.type).toBe('image/webp');
  });
});

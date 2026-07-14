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

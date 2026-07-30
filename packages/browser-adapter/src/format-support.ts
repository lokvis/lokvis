/**
 * FormatSupportProbe —— 编码格式真实支持探测(ADR-015)
 *
 * 浏览器缺少某格式编码器时(典型如 AVIF),canvas.toBlob / convertToBlob
 * 会按 HTML 规范静默回退为 PNG,造成"用户选 AVIF 却得到 PNG"的错位。
 * 本探测对每个格式实际编码一张 1×1 画布,比对产出 MIME 与预期:
 *   - 一致 → 支持
 *   - 不一致(静默回退)或抛错 → 不支持
 *
 * 统一自三处历史实现(engine-image detectFormatSupport 语义为准):
 * - engine-image/src/canvas-engine.ts detectFormatSupport
 * - embed-image/src/internal/format-support.ts detectEncodeSupport
 *
 * 环境安全:非浏览器环境(无 OffscreenCanvas / document)时,
 * png/jpeg 仍短路为 true,其余格式一律 false,不抛错。
 */

/** 格式 → MIME 映射(与 engine-image MIME_BY_FORMAT 保持一致) */
const MIME_BY_FORMAT: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

/** 把 1×1 画布编码为指定 MIME(兼容 OffscreenCanvas 与 DOM canvas) */
async function encodeToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mime: string
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality: 0.8 });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas encode failed'));
      },
      mime,
      0.8
    );
  });
}

/**
 * 检测浏览器对各编码格式的真实支持情况。
 *
 * PNG / JPEG 所有浏览器均支持,直接短路返回 true(省去无谓编码,
 * 也避免在无 canvas 的测试环境误判)。
 *
 * @param formats 待检测的格式列表(如 ['png', 'webp', 'avif', 'jpeg'])
 * @returns 格式 → 是否支持 的映射
 */
export async function detectEncodeSupport(
  formats: readonly string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const toDetect: string[] = [];
  for (const fmt of formats) {
    if (fmt === 'png' || fmt === 'jpeg') {
      results[fmt] = true;
    } else {
      toDetect.push(fmt);
    }
  }
  if (toDetect.length === 0) {
    return results;
  }

  // 非浏览器环境(SSR / 单测):无 canvas,待测格式一律记为不支持
  // OffscreenCanvas 必须先获取渲染上下文,否则 convertToBlob 按规范抛
  // InvalidStateError("has no rendering context"),所有格式会被误判为不支持。
  let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(1, 1);
    (canvas as OffscreenCanvas).getContext('2d');
  } else if (typeof document !== 'undefined') {
    canvas = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
  }
  if (!canvas) {
    for (const fmt of toDetect) {
      results[fmt] = false;
    }
    return results;
  }

  await Promise.all(
    toDetect.map(async (fmt) => {
      const mime = MIME_BY_FORMAT[fmt];
      if (!mime) {
        results[fmt] = false;
        return;
      }
      try {
        const blob = await encodeToBlob(canvas, mime);
        // 产出 MIME 与预期一致才算支持;回退的 image/png 会在此判负
        results[fmt] = blob.type === mime;
      } catch {
        results[fmt] = false;
      }
    })
  );
  return results;
}

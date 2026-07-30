/**
 * CanvasFactory —— Canvas 创建与编解码原语(ADR-015)
 *
 * 收编 engine-image/src/canvas-engine.ts 中触碰原生 API 的原语:
 * OffscreenCanvas / document.createElement('canvas') / getContext /
 * toBlob / convertToBlob / createImageBitmap。
 *
 * 引擎层的业务语义(MIME 映射、静默回退判错、resize 降级策略)仍留在
 * engine-image;这里只提供环境安全的原生 API 访问点。
 */

/** 通用画布类型(浏览器 DOM Canvas 或 OffscreenCanvas) */
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/** Canvas 2D Context 类型(兼容 OffscreenCanvas 与 HTMLCanvasElement) */
export type Canvas2DContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

/** 是否支持 OffscreenCanvas */
export function isOffscreenCanvasSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

/** 是否支持 createImageBitmap */
export function isCreateImageBitmapSupported(): boolean {
  return typeof createImageBitmap === 'function';
}

/**
 * 创建 Canvas(优先 OffscreenCanvas,回退到 DOM Canvas)。
 *
 * 两者皆不可用(Node/SSR)时抛语义化错误。
 */
export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === 'undefined') {
    throw new Error(
      'Canvas is not available: neither OffscreenCanvas nor document exists in this environment'
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** 获取 Canvas 的 2D Context(失败抛错) */
export function get2DContext(canvas: AnyCanvas): Canvas2DContext {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }
  return ctx as Canvas2DContext;
}

/**
 * 把画布编码为指定 MIME 的 Blob(quality 0-1)。
 *
 * 注意:浏览器缺编码器时会按规范静默回退 PNG,本函数不判错,
 * 由调用方(engine-image encodeImage / FormatSupportProbe)比对
 * 产出 MIME 决定语义。
 */
export async function encodeCanvasToBlob(
  canvas: AnyCanvas,
  mime: string,
  quality: number
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error(`Failed to encode canvas as ${mime}`));
      },
      mime,
      quality
    );
  });
}

/**
 * 解码 Blob 为 ImageBitmap(可选解码期缩放)。
 *
 * createImageBitmap 不可用时抛语义化错误(与 engine-image 原行为一致)。
 * resize 选项不受支持(旧 Safari)时抛出的错误由调用方捕获降级。
 */
export async function decodeToBitmap(
  blob: Blob,
  resize?: { width: number; height: number }
): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not supported in this environment');
  }
  if (resize) {
    return createImageBitmap(blob, {
      resizeWidth: resize.width,
      resizeHeight: resize.height,
      resizeQuality: 'high',
    });
  }
  return createImageBitmap(blob);
}

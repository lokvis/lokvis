/**
 * 图像元数据读取(Node 引擎)
 *
 * 与浏览器版的 decode 返回 { width, height } 对齐:提供轻量级元数据读取,
 * 供消费方(如 mcp-server tool)在处理结果文本中报告尺寸/格式。
 *
 * 与浏览器版 decode 的差异:不返回 ImageBitmap(Node 无此类型),只返回纯元数据。
 * sharp 的 .metadata() 不会完整解码图像,开销低。
 *
 * AGENTS.md:Engine 层不感知 Asset/Workflow。本函数为 Blob → 纯元数据,
 * 与浏览器版 decode(Blob → DecodedImage)语义一致,属 Engine 层职责。
 */
import { throwIfAborted } from './utils.js';

/** 图像元数据(width/height/format,不含位图数据) */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 读取图像元数据(width / height / format),不完整解码。
 *
 * @param blob 输入图像 Blob
 * @param _params 预留参数(当前无配置项),与 BlobOperation 签名对齐
 * @param signal 可选取消信号
 * @throws 图像损坏或格式不支持时抛错
 */
export async function getMetadata(
  blob: Blob,
  _params: Record<string, any> = {},
  signal?: AbortSignal
): Promise<ImageMetadata> {
  const sharp = (await import('sharp')).default;
  throwIfAborted(signal);

  const srcBuffer = await blobToBuffer(blob);
  throwIfAborted(signal);

  const meta = await sharp(srcBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error('getMetadata: invalid image dimensions');
  }
  return { width, height, format: meta.format ?? 'unknown' };
}

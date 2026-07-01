/**
 * 开发者工具能力共享工具
 *
 * - INLINE_ENGINE: 内联实现使用的前哨 engine 名
 * - createJsonAsset: 把任意可 JSON 序列化的值封装为 data 类型 Asset
 */
import type { Asset, AssetMetadata, PluginContext } from '@lokvis/schema';

/**
 * 内联实现使用的前哨 engine 名。
 * CapabilityImplementation 类型要求填写 engine 字段,
 * 但本插件无外部引擎依赖,统一用 'builtin' 表示在 Plugin 内直接实现。
 */
export const INLINE_ENGINE = 'builtin';

/**
 * 把任意可 JSON 序列化的值封装为 data 类型的 Asset。
 * 所有开发者工具能力的输出都是 JSON 文本,统一走此工具函数。
 */
export function createJsonAsset(
  ctx: PluginContext,
  value: unknown
): Promise<Asset> {
  const json = JSON.stringify(value, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const metadata: AssetMetadata = {
    mimeType: 'application/json',
    size: blob.size,
    format: 'json',
  };
  return ctx.runtime.createAsset(blob, metadata, 'data');
}

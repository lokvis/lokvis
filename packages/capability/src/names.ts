/**
 * 标准能力命名空间与命名约定
 *
 * 命名规则：`<domain>.<action>`，例如 `image.resize`。
 * - domain：能力所属领域，与 AssetType 对齐或为 `asset`/`ai` 等横切领域
 * - action：具体动作，动词或动词短语
 *
 * 能力名的单一事实源是 `packages/capability/manifests/*.manifest.json`,
 * 经 codegen 生成 `@lokvis/schema` 的 `BuiltinCapabilityName` 字面量联合类型
 * 与 `BUILTIN_CAPABILITY_NAMES` 常量数组。此处不再手写能力名常量对象
 * (曾经的 CAPABILITY_NAMES 已删除:它与 manifest 长期漂移,且全仓无消费者)。
 */

export const CAPABILITY_DOMAINS = [
  'asset',
  'image',
  'video',
  'audio',
  'pdf',
  'text',
  'data',
  'ai',
  'developer',
] as const;

export type CapabilityDomain = (typeof CAPABILITY_DOMAINS)[number];

/** 解析能力名的领域部分 */
export function domainOf(capability: string): string {
  const idx = capability.indexOf('.');
  return idx === -1 ? capability : capability.slice(0, idx);
}

/** 解析能力名的动作部分 */
export function actionOf(capability: string): string {
  const idx = capability.indexOf('.');
  return idx === -1 ? '' : capability.slice(idx + 1);
}

/** 判断两个能力是否属于同一领域 */
export function sameDomain(a: string, b: string): boolean {
  return domainOf(a) === domainOf(b);
}

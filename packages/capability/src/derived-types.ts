/**
 * 从 manifest 派生的强类型枚举。
 *
 * 设计依据 ADR-013:manifest 是能力声明的唯一信息源。
 * TypeScript 无法从 `CapabilityParam[]` 自动派生字面量联合类型
 * (因为 `name: string` 不是字面量),所以这里手写联合类型,
 * 并在测试中校验其与 manifest 的 values 数组完全一致。
 *
 * 上层包(mcp-server / ui-react / sdk 等)消费这些类型,
 * 不再各自本地复制(原 mcp-server/src/tools/image.ts 即为此问题)。
 */

/**
 * 图像水印位置枚举。
 *
 * 与 manifest 的 IMAGE_WATERMARK.params.position.values 必须保持一致,
 * 由 packages/capability/src/__tests__/derived-types.test.ts 校验。
 *
 * 与 engine-image 的 WatermarkPosition 在语义上对齐:
 * manifest 是声明层真理源,engine-image 是实现层类型。
 */
export type ImageWatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'tile';

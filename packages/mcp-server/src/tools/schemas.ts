/**
 * MCP tool 参数 zod schema 与运行时校验。
 *
 * O-15:消除 7 处 `as Parameters<typeof ...>[0]` 断言 —— 这些断言只做
 * TypeScript 编译期类型擦除,无运行时校验。AI 客户端传入的
 * `Record<string, unknown>` 若类型不匹配(如 `width: "100"` 字符串),
 * 断言会放行,直到 engine 层才以混乱错误暴露。
 *
 * 设计:
 * - 每个 schema 只做结构性类型校验(string/number/array/enum),
 *   不做业务规则校验(如 quality 1-100、至少 2 个 PDF)。
 *   业务规则保留在 handler 内,与既有测试一致。
 * - zod 默认 strip 未知字段,与 handler 只读已知字段的行为一致。
 * - 校验失败返回 MCP error result(不抛异常),与 handler 错误风格一致。
 *
 * 注意:server.ts 顶部注释「tool handler 使用 raw JSON schema 定义
 * inputSchema(无需 Zod)」指的是 MCP 协议层暴露给客户端的 inputSchema
 * 声明仍用 raw JSON Schema,与本文件的内部运行时校验是不同关注点。
 */

import { z } from 'zod';
import type { McpToolResult } from '../server.js';

// ──────────────────────────────────────────────────────────────────────────
// Image tool schemas
// ──────────────────────────────────────────────────────────────────────────

/** lokvis_image_resize */
export const resizeSchema = z.object({
  input_path: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).optional(),
  output_path: z.string().optional(),
});

/** lokvis_image_compress */
export const compressSchema = z.object({
  input_path: z.string(),
  quality: z.number().optional(),
  output_path: z.string().optional(),
});

/** lokvis_image_convert */
export const convertSchema = z.object({
  input_path: z.string(),
  format: z.enum(['jpeg', 'png', 'webp', 'avif']),
  quality: z.number().optional(),
  output_path: z.string().optional(),
});

/** lokvis_image_crop */
export const cropSchema = z.object({
  input_path: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  output_path: z.string().optional(),
});

/**
 * lokvis_image_watermark position 枚举值。
 *
 * 与 @lokvis/capability 的 IMAGE_WATERMARK.params.position.values 必须保持
 * 一致(参见 schemas.test.ts 一致性测试)。manifest 更新时,该数组与
 * derived-types.ts 的 ImageWatermarkPosition 均需同步,测试会捕获遗漏。
 *
 * 用 `as const` 保留字面量类型,使 zod enum 能推断出精确联合类型
 * 'top-left' | 'top-right' | ...,与 imageWatermark handler 的
 * WatermarkPosition 参数类型对齐。
 */
export const WATERMARK_POSITION_VALUES = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
  'tile',
] as const;

/** lokvis_image_watermark */
export const watermarkSchema = z.object({
  input_path: z.string(),
  text: z.string().optional(),
  image: z.string().optional(),
  position: z.enum(WATERMARK_POSITION_VALUES).optional(),
  opacity: z.number().optional(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  output_path: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────────────────
// PDF tool schemas
// ──────────────────────────────────────────────────────────────────────────

/** lokvis_pdf_merge */
export const pdfMergeSchema = z.object({
  input_paths: z.array(z.string()),
  output_path: z.string().optional(),
});

/** lokvis_pdf_compress */
export const pdfCompressSchema = z.object({
  input_path: z.string(),
  level: z.number().optional(),
  output_path: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────────────────
// 校验辅助
// ──────────────────────────────────────────────────────────────────────────

/**
 * 校验 MCP tool 参数,返回 `{ data }` 或 `{ error }`。
 *
 * 错误格式化为 MCP error result(content + isError),由 wrapper 直接返回。
 * 错误文本包含每个 zod issue 的路径与消息,便于 AI 客户端诊断。
 *
 * @example
 * ```ts
 * const r = validateParams(resizeSchema, params);
 * if (!r.success) return r.error;
 * return imageResize(r.data, runtime);
 * ```
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, unknown>
):
  | { success: true; data: T }
  | { success: false; error: McpToolResult } {
  const result = schema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const details = result.error.issues
    .map((i) => {
      const path = i.path.length > 0 ? i.path.join('.') : '<root>';
      return `${path}: ${i.message}`;
    })
    .join('; ');
  return {
    success: false,
    error: {
      content: [
        { type: 'text', text: `Invalid params: ${details}` },
      ],
      isError: true,
    },
  };
}

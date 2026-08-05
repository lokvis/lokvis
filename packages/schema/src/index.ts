/**
 * @lokvis/schema
 *
 * Lokvis Schema - Workflow / Asset / Plugin / Event 类型定义与校验器。
 * 这是整个项目的稳定核心，变化最慢，严格 semver，无 Breaking Change。
 */

// 核心类型
export * from './asset.js';
export * from './capability.js';
// 由 codegen 从 manifest 生成的精确能力名字面量类型 + 常量数组(单一来源)
export * from './capability-names.generated.js';
export * from './workflow.js';
// 计划门控限额常量(FO-05 单一事实源:批量/并发/UI 本地上限)
export * from './plan-limits.js';
export * from './event.js';
export * from './plugin.js';
export * from './exif.js';
// 跨层共享的资产元数据查询类型(ImageMetadata / PdfInfo,见 metadata.ts)
export * from './metadata.js';
// MIME ↔ format ↔ ext ↔ AssetType 映射表(FO-14 单一事实源)
export * from './media-formats.js';
// MCP manifest 类型(见 docs/AI生态冲击调整方案.md §6.1)
export * from './mcp.js';

// Zod 校验器
export * from './validators.js';

// 版本信息
export const SCHEMA_VERSION = '1.0.0' as const;
export const RUNTIME_MIN_VERSION = '0.1.0' as const;

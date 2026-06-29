/**
 * @lokvis/schema
 *
 * Lokvis Schema - Workflow / Asset / Plugin / Event 类型定义与校验器。
 * 这是整个项目的稳定核心，变化最慢，严格 semver，无 Breaking Change。
 */

// 核心类型
export * from './asset.js';
export * from './capability.js';
export * from './workflow.js';
export * from './event.js';
export * from './plugin.js';

// Zod 校验器
export * from './validators.js';

// 版本信息
export const SCHEMA_VERSION = '1.0.0' as const;
export const RUNTIME_MIN_VERSION = '0.1.0' as const;

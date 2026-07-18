/**
 * @lokvis/capability
 *
 * 能力注册中心工具包。提供：
 * - 标准能力命名约定（`<domain>.<action>`）
 * - 内置能力声明常量（image.resize / image.compress / ...）
 * - 能力查询/过滤/分组工具
 *
 * Runtime 永远不知道 FFmpeg，只知道 Capability。
 * 本包不依赖任何具体引擎实现。
 */

export * from './names.js';
export * from './presets/index.js';
export * from './helpers.js';
export * from './derived-types.js';

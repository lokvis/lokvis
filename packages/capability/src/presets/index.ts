/**
 * 内置能力声明预设(聚合入口)
 *
 * 各域能力定义按类型拆分到独立文件,此处统一 re-export,
 * 外部导入路径 `@lokvis/capability` 保持不变。
 *
 * 迁移状态(W4.3 + 问题 C 完成):
 * - image/pdf/video/audio/ai/developer/archive:由 codegen 从 manifests/*.manifest.json
 *   生成(见 packages/capability/manifests/),手写版本已删除
 * - asset:保留手写(无对应 plugin,无 operation entries;archive 项已迁至 archive.* 域)
 * - platform:平台尺寸预设库(W8.1,20+ 平台)
 * - builtin:BUILTIN_CAPABILITIES 聚合
 */
export * from './image.generated.js';
export * from './pdf.generated.js';
export * from './video.generated.js';
export * from './audio.generated.js';
export * from './ai.generated.js';
export * from './developer.generated.js';
export * from './archive.generated.js';
export * from './asset.js';
export * from './platform.js';
export * from './builtin.js';

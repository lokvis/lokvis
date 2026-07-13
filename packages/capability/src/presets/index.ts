/**
 * 内置能力声明预设(聚合入口)
 *
 * 各域能力定义按类型拆分到独立文件,此处统一 re-export,
 * 外部导入路径 `@lokvis/capability` 保持不变。
 *
 * - image.ts:     图像能力(8 个)
 * - pdf.ts:       PDF 能力(7 个)
 * - video.ts:     视频能力(7 个)
 * - audio.ts:     音频能力(4 个)
 * - asset.ts:     Asset 通用能力(2 个)
 * - developer.ts: Developer 工具能力(4 个)
 * - platform.ts:  平台尺寸预设库(W8.1,20+ 平台)
 * - builtin.ts:   BUILTIN_CAPABILITIES 聚合
 */
export * from './image.js';
export * from './pdf.js';
export * from './video.js';
export * from './audio.js';
export * from './asset.js';
export * from './developer.js';
export * from './platform.js';
export * from './builtin.js';

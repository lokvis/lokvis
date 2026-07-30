/**
 * @lokvis/browser-adapter
 *
 * Browser Adapter Layer(ADR-015)——全仓唯一允许触碰原生浏览器 API 的
 * 非 Presentation 包。六层架构最底层(Engine 之下)。
 *
 * 模块划分(按能力域):
 * - env-probe:能力探测 + UA 嗅探(原 runtime browser-detect)
 * - format-support:编码格式真实支持探测(1×1 画布实编)
 * - media-probe:图片尺寸 / 音视频时长提取
 * - storage:OPFS 根目录入口
 * - kv-store:IndexedDB(Dexie)泛型 KV 存储
 * - canvas:Canvas 创建与编解码原语
 * - worker:Web Worker 创建
 * - file-picker:File System Access(预留,仅类型)
 *
 * 环境安全约定:所有实现在 Node/SSR 下不抛 ReferenceError——以特性
 * 检测 + 优雅降级(返回空/false/抛语义化错误)代替。
 *
 * 测试 fake 经 `@lokvis/browser-adapter/test-utils` 子路径导入。
 */

export * from './env-probe.js';
export * from './format-support.js';
export * from './media-probe.js';
export * from './storage.js';
export * from './kv-store.js';
export * from './canvas.js';
export * from './worker.js';
export * from './file-picker.js';

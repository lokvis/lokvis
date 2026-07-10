/**
 * 图像引擎适配器选择
 *
 * Runtime 根据浏览器能力、性能、用户偏好自动选择最佳引擎。
 * MVP 默认使用 canvas 引擎，未来可注册 squoosh 引擎。
 *
 * 使用 @lokvis/engine-core 的 createEngineRegistry 工厂,与 engine-pdf /
 * engine-video / engine-audio / engine-ai 保持一致的注册表实现。
 */

import { createEngineRegistry } from '@lokvis/engine-core';
import type { ImageEngineAdapter, ImageEngineName } from './types.js';
import { canvasEngine } from './canvas-engine.js';

const registry = createEngineRegistry<ImageEngineAdapter>(
  [canvasEngine],
  canvasEngine
);

/** 注册图像引擎 */
export function registerImageEngine(engine: ImageEngineAdapter): void {
  registry.register(engine);
}

/** 获取指定引擎(未命中时回退到 canvasEngine) */
export function getEngine(name?: ImageEngineName): ImageEngineAdapter {
  return registry.get(name);
}

/** 列出所有已注册引擎 */
export function listEngines(): ImageEngineAdapter[] {
  return registry.list();
}

/** 异步选择最佳可用引擎(按注册顺序,canvas 优先) */
export async function selectBestEngine(): Promise<ImageEngineAdapter> {
  return registry.selectBest();
}

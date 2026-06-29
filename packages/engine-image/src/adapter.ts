/**
 * 图像引擎适配器选择
 *
 * Runtime 根据浏览器能力、性能、用户偏好自动选择最佳引擎。
 * MVP 默认使用 canvas 引擎，未来可注册 squoosh 引擎。
 */

import type { ImageEngineAdapter, ImageEngineName } from './types.js';
import { canvasEngine } from './canvas-engine.js';

/** 已注册的图像引擎 */
const engines = new Map<ImageEngineName, ImageEngineAdapter>();

/** 注册图像引擎 */
export function registerImageEngine(engine: ImageEngineAdapter): void {
  engines.set(engine.name, engine);
}

/** 获取指定引擎 */
export function getEngine(name?: ImageEngineName): ImageEngineAdapter {
  if (name) {
    const e = engines.get(name);
    if (e) return e;
  }
  // 默认返回 canvas 引擎
  return canvasEngine;
}

/** 列出所有已注册引擎 */
export function listEngines(): ImageEngineAdapter[] {
  return Array.from(engines.values());
}

/** 异步选择最佳可用引擎 */
export async function selectBestEngine(): Promise<ImageEngineAdapter> {
  // 优先 canvas（MVP 已够用）
  if (await canvasEngine.isSupported()) {
    return canvasEngine;
  }
  // 回退到其他已注册引擎
  for (const engine of engines.values()) {
    if (engine.name !== 'canvas' && (await engine.isSupported())) {
      return engine;
    }
  }
  return canvasEngine;
}

// 默认注册 canvas 引擎
registerImageEngine(canvasEngine);

/**
 * Engine 预加载桥接（review fix for Major-2）
 *
 * 架构约束（AGENTS.md）：UI → Workflow → Runtime → Capability → Engine，
 * 禁止跨层引用。原 EngineLoader.tsx / PlaygroundLayout.astro 直接 import
 * `@lokvis/engine-image/lazy.js`，属于 UI → Engine 跨层违规。
 *
 * 本模块在 Capability 层（plugin-image）提供 thin re-export，使 UI 通过
 * Capability 层访问 Engine 懒加载工具，符合单向依赖：
 *   UI → Capability (plugin-image) → Engine (engine-image/lazy.js)
 *
 * plugin-image 已依赖 engine-image（operations.ts 中 import 各 operation），
 * 故本 re-export 不引入新依赖，仅补全架构边界。
 */
export {
  lazyLoadOperation,
  prefetchOperation,
  preloadTop5Operations,
  clearOperationCache,
  isOperationLoaded,
  TOP_5_OPERATIONS,
} from '@lokvis/engine-image/lazy.js';
export type { BlobOperation } from '@lokvis/engine-image/lazy.js';

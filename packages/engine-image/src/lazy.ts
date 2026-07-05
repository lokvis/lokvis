/**
 * Engine 模块懒加载(W15.2)
 *
 * 当前 MVP 引擎是浏览器原生 Canvas,体积小,所有操作直接 bundling 进首屏
 * 也可接受。但本模块为未来 WASM 引擎(Squoosh / ImageMagick)预留懒加载
 * 基础设施——一旦接入,只需把 importer 指向新的 chunk,UI 层无需改动。
 *
 * 设计目标:
 *   1. 按操作类别(transform / encode / watermark / ...)拆分 chunk,Vite
 *      会把 dynamic import 目标拆成独立 chunk,首屏不加载。
 *   2. `loadEngineModule(name)`:首次调用触发 import,后续返回缓存 Promise
 *   3. `prefetchEngineModule(name)`:不阻塞主流程,失败后允许重试
 *   4. `prefetchOnHover(name, element)`:UI 集成——用户 hover/focus 工具按钮
 *      时预拉取对应 engine chunk,首次点击几乎无延迟
 *   5. `getLoadStatus(name)`:供 EngineLoader.tsx(W15.8)展示进度状态
 *
 * 与 Service Worker(W15.1)的协作:
 *   - SW 端 `TOP5_ENGINE_URLS` 列表与本模块的 `CAPABILITY_TO_MODULE` 映射保持一致
 *   - SW 在 fetch 阶段对 /engines/* 路径走 cache-first + 重试
 *   - 本模块的 dynamic import 在生产环境会请求这些 URL,SW 自动接管缓存
 *
 * 注意:
 *   - 当前 canvas engine 操作文件已在主 bundle 内,这些 dynamic import 实际
 *     不会产生额外网络请求(Vite 会把同包内的相对路径静态分析后内联)。
 *     接入 WASM 引擎后,把 importer 改成 `() => import('squoosh')` 即可。
 */

/** 引擎操作模块名(对应 src/operations/*.ts) */
export type EngineModuleName =
  | 'transform' // resize / crop / rotate / flip
  | 'encode' // compress / convert / setBackground
  | 'watermark' // 文字 / 图片水印
  | 'compress-target' // 目标体积压缩(二分查找)
  | 'filters' // 简单滤镜
  | 'png-metadata' // PNG DPI 嵌入
  | 'tiles'; // 大图分片

/** 模块加载状态 */
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** 动态 import 工厂表(键即 EngineModuleName) */
const IMPORTERS: Record<EngineModuleName, () => Promise<unknown>> = {
  transform: () => import('./operations/transform.js'),
  encode: () => import('./operations/encode.js'),
  watermark: () => import('./operations/watermark.js'),
  'compress-target': () => import('./operations/compress-target.js'),
  filters: () => import('./operations/filters.js'),
  'png-metadata': () => import('./operations/png-metadata.js'),
  tiles: () => import('./operations/tiles.js'),
};

/** Capability → Module 映射(与 sw.js TOP5_ENGINE_URLS 对齐) */
export const CAPABILITY_TO_MODULE: Record<string, EngineModuleName> = {
  'image.resize': 'transform',
  'image.crop': 'transform',
  'image.rotate': 'transform',
  'image.flip': 'transform',
  'image.compress': 'encode',
  'image.convert': 'encode',
  'image.background': 'encode',
  'image.watermark': 'watermark',
  'image.filter': 'filters',
};

/** Top 5 最常用 capability 对应的模块(W15.7 SW 预加载同步用) */
export const TOP5_MODULES: EngineModuleName[] = [
  'transform', // resize + crop
  'encode', // compress + convert
  'watermark',
  'compress-target',
  'filters',
];

// ─── 内部缓存 ────────────────────────────────────────────────────

const moduleCache = new Map<EngineModuleName, Promise<unknown>>();
const statusMap = new Map<EngineModuleName, LoadStatus>();

// 初始化状态
for (const name of Object.keys(IMPORTERS) as EngineModuleName[]) {
  statusMap.set(name, 'idle');
}

function setStatus(name: EngineModuleName, status: LoadStatus) {
  statusMap.set(name, status);
}

// ─── 公开 API ────────────────────────────────────────────────────

/**
 * 加载指定 engine 模块(首次触发 dynamic import,后续返回缓存)。
 *
 * 失败时不缓存 rejection,允许下次重试。
 *
 * 注:此处故意不使用 `async` 关键字——async 函数会包装返回值为新 Promise,
 * 导致同一模块的两次调用返回不同的 Promise 实例,破坏缓存语义。
 * 直接返回内部缓存的 Promise 引用即可。
 */
export function loadEngineModule<T = unknown>(
  name: EngineModuleName
): Promise<T> {
  let promise = moduleCache.get(name);
  if (!promise) {
    setStatus(name, 'loading');
    promise = IMPORTERS[name]().then(
      (mod) => {
        setStatus(name, 'loaded');
        return mod;
      },
      (err) => {
        // 失败后清缓存,允许重试
        moduleCache.delete(name);
        setStatus(name, 'error');
        throw err;
      }
    );
    moduleCache.set(name, promise);
  }
  return promise as Promise<T>;
}

/**
 * 预拉取 engine 模块(不阻塞主流程)。
 *
 * 用于:
 *   - SW 安装后预加载 top 5(W15.7)
 *   - 用户 hover 工具按钮时预拉取(prefetchOnHover)
 *
 * 失败时静默 console.warn,不上抛。
 */
export function prefetchEngineModule(name: EngineModuleName): void {
  if (moduleCache.has(name)) return;
  void loadEngineModule(name).catch((err) => {
    console.warn(`[engine-image] prefetch "${name}" failed:`, err);
  });
}

/**
 * 预加载全部 top 5 engine 模块(W15.7 PWA 安装后调用)。
 *
 * 并发拉取,任一失败不影响其他。返回每个模块的状态。
 */
export async function preloadTop5Engines(): Promise<
  Record<EngineModuleName, LoadStatus>
> {
  await Promise.allSettled(TOP5_MODULES.map((name) => loadEngineModule(name)));
  const result = {} as Record<EngineModuleName, LoadStatus>;
  for (const name of TOP5_MODULES) {
    result[name] = getLoadStatus(name);
  }
  return result;
}

/**
 * 查询模块当前加载状态(供 EngineLoader UI 使用)。
 */
export function getLoadStatus(name: EngineModuleName): LoadStatus {
  return statusMap.get(name) ?? 'idle';
}

/**
 * 通过 capability ID 查询对应模块状态。
 *
 * 例如 `getLoadStatusByCapability('image.resize')` 返回 transform 模块状态。
 * 未知 capability 返回 'idle'。
 */
export function getLoadStatusByCapability(capability: string): LoadStatus {
  const name = CAPABILITY_TO_MODULE[capability];
  if (!name) return 'idle';
  return getLoadStatus(name);
}

/**
 * Hover/Focus 预拉取绑定(W15.2 UI 集成核心 API)。
 *
 * 给 DOM 元素挂监听:用户鼠标移入或键盘聚焦时,预拉取对应 engine 模块。
 * 触发后自动移除监听(once),避免重复预拉取。
 *
 * @returns 清理函数,在组件 unmount 时调用,移除残留监听
 *
 * @example
 *   const cleanup = prefetchOnHover('transform', buttonEl);
 *   useEffect(() => cleanup, []);
 */
export function prefetchOnHover(
  name: EngineModuleName,
  element: HTMLElement
): () => void {
  // 已加载则无需监听
  if (getLoadStatus(name) === 'loaded') return () => {};

  const trigger = () => {
    prefetchEngineModule(name);
    cleanup();
  };

  const cleanup = () => {
    element.removeEventListener('mouseenter', trigger);
    element.removeEventListener('focus', trigger);
  };

  element.addEventListener('mouseenter', trigger, { once: true });
  element.addEventListener('focus', trigger, { once: true });

  return cleanup;
}

/**
 * 通过 capability ID 触发 hover 预拉取(便捷封装)。
 */
export function prefetchOnHoverCapability(
  capability: string,
  element: HTMLElement
): () => void {
  const name = CAPABILITY_TO_MODULE[capability];
  if (!name) return () => {};
  return prefetchOnHover(name, element);
}

/**
 * 重置所有缓存(主要用于测试)。
 */
export function _resetLazyCache(): void {
  moduleCache.clear();
  for (const name of Object.keys(IMPORTERS) as EngineModuleName[]) {
    statusMap.set(name, 'idle');
  }
}

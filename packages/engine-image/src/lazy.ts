/**
 * Engine 操作懒加载（W15.2）
 *
 * 设计目标：
 * - 用户触发工具时才 dynamic import 对应 operation，减少首屏 JS 体积
 * - prefetchOnHover 在用户 hover 工具按钮时预加载（不阻塞主线程）
 * - 同一接口未来可承载 WASM 引擎（Squoosh AVIF/WebP 编码器）
 *
 * 注意：本模块当前服务于 Canvas engine（零 WASM），
 * 但 lazyLoadOperation / prefetchOperation 接口与 WASM 引擎兼容。
 *
 * 适配说明：operations 实际导出名为 resize/compress/convert/crop/
 * watermark/rotate/flip/setBackground/filter（非 resizeOp 命名），
 * 故 loader 直接在 .then() 中提取具名导出。
 */

/** Engine 层 Blob↔Blob 操作函数签名（与 AGENTS.md Record<string, any> 约定一致） */
export type BlobOperation = (
  blob: Blob,
  params: Record<string, any>,
  signal?: AbortSignal
) => Promise<Blob>;

/** 懒加载的 operation 工厂表（key = capability 短名） */
type OperationFactory = () => Promise<BlobOperation>;

/** 已加载 operation 缓存（避免重复 import） */
const loadedOperations = new Map<string, BlobOperation>();

/** 加载中 promise（去重并发请求） */
const loadingPromises = new Map<string, Promise<BlobOperation>>();

/** 预加载映射：capability 短名 → dynamic import 工厂
 *
 * 用静态 import() 表达式（webpack/vite/rollup 都能识别为代码分割点），
 * 不能用变量作为 import() 参数（会破坏静态分析）。
 * 每个 capability 指向其所在源文件，使 chunk 切分更细。
 */
const OPERATION_LOADERS: Record<string, OperationFactory> = {
  resize: () => import('./operations/transform.js').then((m) => m.resize),
  compress: () => import('./operations/encode.js').then((m) => m.compress),
  convert: () => import('./operations/encode.js').then((m) => m.convert),
  crop: () => import('./operations/transform.js').then((m) => m.crop),
  watermark: () => import('./operations/watermark.js').then((m) => m.watermark),
  // 以下为 top 5 之外的能力（仍可懒加载，但不在预缓存范围）
  rotate: () => import('./operations/transform.js').then((m) => m.rotate),
  flip: () => import('./operations/transform.js').then((m) => m.flip),
  background: () => import('./operations/encode.js').then((m) => m.setBackground),
  filter: () => import('./operations/filters.js').then((m) => m.filter),
};

/** top 5 capability（用于预缓存/预加载范围控制） */
export const TOP_5_OPERATIONS = [
  'resize',
  'compress',
  'watermark',
  'convert',
  'crop',
] as const;

/**
 * 懒加载指定 operation。
 *
 * 故意不使用 `async` 关键字：async 会把每次 `return existing` 包成新 Promise，
 * 破坏并发去重的 promise 同一性（调用方无法通过 === 判断是否命中 in-flight）。
 * 显式返回 Promise 后，`return existing` 直接返回同一个 in-flight promise，
 * 使 loadingPromises 的去重对外可观测，且 `return Promise.reject(...)` 保证
 * 错误以 rejected promise 形式传播（与 await 配合一致）。
 *
 * @param capability 短名（如 'resize'，不含 'image.' 前缀）
 * @returns 加载完成的 BlobOperation
 * @throws Error 若 capability 不在 OPERATION_LOADERS 中（以 rejected promise 形式）
 */
export function lazyLoadOperation(
  capability: string
): Promise<BlobOperation> {
  // 命中缓存直接返回
  const cached = loadedOperations.get(capability);
  if (cached) return Promise.resolve(cached);

  // 去重并发请求
  const existing = loadingPromises.get(capability);
  if (existing) return existing;

  const loader = OPERATION_LOADERS[capability];
  if (!loader) {
    return Promise.reject(
      new Error(
        `Unknown engine operation: ${capability}. Available: ${Object.keys(
          OPERATION_LOADERS
        ).join(', ')}`
      )
    );
  }

  const promise = loader()
    .then((op) => {
      loadedOperations.set(capability, op);
      loadingPromises.delete(capability);
      return op;
    })
    .catch((err) => {
      loadingPromises.delete(capability);
      throw err;
    });

  loadingPromises.set(capability, promise);
  return promise;
}

/**
 * 预加载 operation（不返回结果，仅触发 import）。
 *
 * 用于 prefetchOnHover：用户 hover 工具按钮时调用，
 * 浏览器后台下载对应 chunk，用户实际点击时几乎零延迟。
 *
 * 失败静默（prefetch 是优化，不是必需），错误只 console.warn。
 *
 * Review fix：委托给 lazyLoadOperation 以复用 loadingPromises 去重。
 * 原实现直接调 loader() 绕过去重表，若用户 hover 后立即点击，
 * lazyLoadOperation 与 prefetchOperation 会各自发起独立 dynamic import
 * （即使 ESM 模块层可能去重，代码层 dedup 保证被破坏）。现统一走
 * lazyLoadOperation，hover→click 同 tick 内共享同一 in-flight promise。
 */
export function prefetchOperation(capability: string): void {
  // 已加载则跳过
  if (loadedOperations.has(capability)) return;
  // 已在加载中也跳过
  if (loadingPromises.has(capability)) return;

  if (!OPERATION_LOADERS[capability]) {
    console.warn(
      `[engine-image/lazy] Cannot prefetch unknown operation: ${capability}`
    );
    return;
  }

  // 委托给 lazyLoadOperation 复用 loadingPromises 去重（fire-and-forget）
  lazyLoadOperation(capability).catch((err) => {
    console.warn(`[engine-image/lazy] Prefetch failed for ${capability}:`, err);
  });
}

/**
 * 预加载 top 5 operation（用于 PWA 安装后后台静默预加载，W15.7）。
 *
 * 并发触发 5 个 prefetch，全部完成 resolve（任一失败不 reject）。
 * 返回成功加载的 capability 列表。
 */
export async function preloadTop5Operations(): Promise<string[]> {
  const results = await Promise.allSettled(
    TOP_5_OPERATIONS.map(
      (name): Promise<string> => lazyLoadOperation(name).then(() => name)
    )
  );
  return results
    .filter(
      (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled'
    )
    .map((r) => r.value);
}

/**
 * 清理已加载 operation 缓存（用于测试或内存压力场景）。
 */
export function clearOperationCache(): void {
  loadedOperations.clear();
  loadingPromises.clear();
}

/**
 * 查询 operation 是否已加载（同步，用于 UI 状态显示）。
 */
export function isOperationLoaded(capability: string): boolean {
  return loadedOperations.has(capability);
}

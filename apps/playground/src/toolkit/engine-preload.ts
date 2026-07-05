/**
 * Engine 预加载器(W15.7)
 *
 * 在 PWA 安装后(appinstalled 事件)静默预加载 top 5 engine 模块:
 *   1. 主线程调用 `preloadTop5Engines()`(W15.2 lazy.ts),
 *      让 Vite 把 dynamic import 目标 chunk 拉到主线程内存
 *   2. 同时 postMessage 给 SW(`PRELOAD_TOP5_ENGINES`),
 *      SW 用 fetch + cache.put 把同样 URL 写入 engine cache,
 *      下次离线访问也直接命中
 *
 * 双保险的必要性:
 *   - 主线程 preload 后,用户立即触发工具(同一会话)直接命中内存模块缓存
 *   - SW preload 后,下次启动 / 离线场景也能命中 HTTP cache
 *   - 两者并行,任一失败不影响另一个
 *
 * 静默执行:不打断用户操作,失败仅 console.warn。
 *
 * 集成位置:
 *   - 在 PlaygroundLayout 顶层调用 `setupEnginePreloadOnInstalled()`
 *   - 返回值是清理函数,在 dev HMR 重载时移除监听
 */

import { preloadTop5Engines } from '@lokvis/engine-image';

const PRELOAD_FLAG_KEY = 'lokvis:engines-preloaded-at';

/**
 * 安装 appinstalled 监听器,触发时预加载 top 5 engine。
 *
 * @returns 清理函数(移除监听)
 */
export function setupEnginePreloadOnInstalled(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    void preloadEngines();
  };
  window.addEventListener('appinstalled', handler);
  return () => window.removeEventListener('appinstalled', handler);
}

/**
 * 立即预加载 top 5 engine 模块。
 *
 * 通常在 appinstalled 事件触发,也可手动调用(如"预加载引擎"按钮)。
 * 返回每个模块的加载状态。
 */
export async function preloadEngines(): Promise<{
  mainThread: Record<string, string>;
  sw: 'sent' | 'skipped' | 'failed';
}> {
  // 1. 主线程预加载(W15.2 lazy.ts)
  let mainThreadResult: Record<string, string> = {};
  try {
    mainThreadResult = await preloadTop5Engines();
    console.info('[engine-preload] main thread done:', mainThreadResult);
  } catch (err) {
    console.warn('[engine-preload] main thread failed:', err);
  }

  // 2. SW 预加载(postMessage)
  let swResult: 'sent' | 'skipped' | 'failed' = 'skipped';
  try {
    if (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      navigator.serviceWorker.controller
    ) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PRELOAD_TOP5_ENGINES',
      });
      swResult = 'sent';
    }
  } catch (err) {
    console.warn('[engine-preload] SW message failed:', err);
    swResult = 'failed';
  }

  // 3. 记录已预加载(用于诊断 / "已优化"标识)
  try {
    localStorage.setItem(PRELOAD_FLAG_KEY, String(Date.now()));
  } catch {
    /* localStorage 不可用时忽略 */
  }

  return { mainThread: mainThreadResult, sw: swResult };
}

/**
 * 查询是否已预加载过(供 UI 显示"已优化"标识)。
 */
export function isEnginesPreloaded(): boolean {
  try {
    return Boolean(localStorage.getItem(PRELOAD_FLAG_KEY));
  } catch {
    return false;
  }
}

/**
 * 监听 SW 回传的预加载进度(W15.7)
 *
 * SW 在 preloadTop5Engines() 中通过 notifyClients 广播:
 *   - { type: 'ENGINE_PRELOADED', url }
 *   - { type: 'TOP5_PRELOAD_DONE', failed: string[] }
 *
 * @param onProgress 单个模块预加载完成回调
 * @param onDone 全部完成回调
 * @returns 清理函数
 */
export function subscribeEnginePreloadProgress(
  onProgress?: (url: string) => void,
  onDone?: (failed: string[]) => void
): () => void {
  if (
    typeof navigator === 'undefined' ||
    !navigator.serviceWorker
  ) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'ENGINE_PRELOADED' && typeof data.url === 'string') {
      onProgress?.(data.url);
    } else if (data.type === 'TOP5_PRELOAD_DONE') {
      onDone?.(Array.isArray(data.failed) ? data.failed : []);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

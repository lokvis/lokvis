/**
 * Service Worker 注册器(W15.1)
 *
 * 职责:
 *   1. 在 production 环境注册 /sw.js(dev 跳过,避免缓存热重载失败)
 *   2. 监听 SW 更新,通过回调通知 UI 显示"刷新"按钮
 *   3. 提供 `triggerSkipWaiting()` 让用户主动应用更新
 *
 * 使用方式:
 *   import { registerSW } from '../toolkit/register-sw.js';
 *   const { update, triggerSkipWaiting } = registerSW({
 *     onUpdate: () => showUpdateToast(),
 *   });
 */

export interface RegisterSWOptions {
  /** 检测到新 SW waiting 时回调(UI 显示"刷新"按钮) */
  onUpdate?: () => void;
  /** SW 注册成功时回调(用于诊断日志) */
  onRegistered?: (reg: ServiceWorkerRegistration) => void;
}

export interface RegisterSWResult {
  /** 当前注册结果(null 表示不支持 SW / dev 环境) */
  registration: ServiceWorkerRegistration | null;
  /** 用户点击"应用更新"按钮时调用,通知 SW skipWaiting */
  triggerSkipWaiting: () => Promise<void>;
}

/**
 * 注册 Service Worker。
 *
 * - dev 模式(import.meta.env.DEV)跳过:Vite/Astro HMR 与 SW 缓存冲突,
 *   会导致代码改动后页面仍走旧缓存。
 * - 仅在 secure context(https / localhost)可用,navigator.serviceWorker
 *   在非 secure context 下为 undefined。
 */
export function registerSW(
  options: RegisterSWOptions = {}
): RegisterSWResult {
  const { onUpdate, onRegistered } = options;

  // dev 环境或非 secure context 不注册
  if (import.meta.env.DEV) {
    return { registration: null, triggerSkipWaiting: async () => {} };
  }
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { registration: null, triggerSkipWaiting: async () => {} };
  }

  let registration: ServiceWorkerRegistration | null = null;

  // 用 IIFE 注册(不阻塞主流程)
  void (async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      onRegistered?.(registration);

      // 检测到新 SW 进入 waiting 状态(已下载但未激活)
      const notifyIfWaiting = () => {
        if (registration?.waiting) {
          onUpdate?.();
        }
      };
      notifyIfWaiting();
      registration.addEventListener('updatefound', () => {
        const newWorker = registration?.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', notifyIfWaiting);
      });

      // 周期性检查更新(每小时一次,浏览器最小间隔 60s)
      setInterval(
        () => {
          void registration?.update();
        },
        60 * 60 * 1000
      );

      // 监听 SW 控制器变化(新 SW 已接管)→ 自动刷新
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // 避免在加载阶段触发死循环刷新
        if (!window.__lokvisSWReloaded) {
          window.__lokvisSWReloaded = true;
          window.location.reload();
        }
      });
    } catch (err) {
      console.error('[sw] registration failed:', err);
    }
  })();

  return {
    registration,
    triggerSkipWaiting: async () => {
      if (!registration?.waiting) return;
      // 通知 SW 跳过等待,触发 controllerchange → 自动刷新
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    },
  };
}

// 全局标记,防止 controllerchange 死循环刷新
declare global {
  interface Window {
    __lokvisSWReloaded?: boolean;
  }
}

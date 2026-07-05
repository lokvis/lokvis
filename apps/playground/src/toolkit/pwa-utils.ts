/**
 * PWA 工具函数(W15.4 / W15.5)
 *
 * 从 InstallPrompt 中抽出的纯函数,便于单元测试。
 * 所有函数都做了 SSR / 隐私模式兜底,失败时返回安全默认值(不抛错)。
 */

export const DISMISS_KEY = 'lokvis:install-prompt-dismissed-at';
export const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

/** 是否在 standalone 模式(已安装) */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) {
    return true;
  }
  // Chrome/Edge Android / Desktop
  return window.matchMedia('(display-mode: standalone)').matches;
}

/** 是否 iOS Safari(无 beforeinstallprompt,需特殊引导) */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined' || !window.navigator) return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isNotChrome = !/CriOS/.test(ua);
  return isIOS && isWebkit && isNotChrome;
}

/** 是否在冷却期内(用户最近点过 Dismiss) */
export function isDismissedInCooldown(now: number = Date.now()): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (!ts) return false;
    return now - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/** 记录 Dismiss 时间戳(7 天后再弹) */
export function markDismissed(now: number = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    /* localStorage 可能在隐私模式不可用,忽略 */
  }
}

/** 清除 Dismiss 记录(用于测试或"重置安装提示") */
export function clearDismissed(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* 忽略 */
  }
}

// ─── W15.5 — 在线状态 ───────────────────────────────────────────

/** 当前是否在线(SSR / 老浏览器兜底为 true,避免误显示离线提示) */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * 订阅在线状态变化(W15.5)
 *
 * @param callback 状态变化回调
 * @returns 清理函数(组件 unmount 调用)
 */
export function subscribeOnlineStatus(
  callback: (online: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

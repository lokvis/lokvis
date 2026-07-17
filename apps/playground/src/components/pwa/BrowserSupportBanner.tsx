/**
 * BrowserSupportBanner(W22.4)
 *
 * Firefox / 不完整浏览器能力降级提示 UI。
 *
 * 设计:
 * - 启动时调 detectBrowserCapabilities + detectBrowserInfo 探测一次,
 *   结果写入 sessionStorage(避免每次刷新重复弹)
 * - 三类提示分级显示(按严重度排序):
 *   1. Firefox 总体提示(已知能力受限)
 *   2. OPFS 不可用 → 已降级到 IndexedDB(大文件性能下降)
 *   3. OffscreenCanvas 不可用 → 已降级到 HTMLCanvas(主线程阻塞)
 * - 用户可手动 dismiss,状态存 sessionStorage 避免本次会话重复弹
 * - 仅在浏览器(非 SSR)且确有能力缺失时显示,Chrome/Edge/Safari 默认不弹
 *
 * 与 W22.3 browser-detect 配合:本组件消费能力探测结果,
 * 不重复检测(同一会话共享 detectBrowserXxx 缓存)。
 *
 * 纯逻辑(computeBanners / 类型)抽到 ./browser-support-utils.ts,便于单测。
 */
import { useEffect, useState } from 'react';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import {
  detectBrowserCapabilities,
  detectBrowserInfo,
} from '@lokvis/runtime';
import {
  BANNER_ORDER,
  computeBanners,
  type BannerItem,
  type BannerKind,
} from './browser-support-utils.js';

/** sessionStorage 键:记录用户已 dismiss 的提示类型(避免本次会话重复弹) */
const DISMISS_KEY = 'lokvis.browser-support.dismissed';

/** 从 sessionStorage 读取已 dismiss 的 kind 集合 */
function readDismissed(): Set<BannerKind> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as BannerKind[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

/** 写入 dismiss 集合到 sessionStorage */
function writeDismissed(set: Set<BannerKind>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage 不可用(隐私模式)时静默降级:不持久化,仅本次内存态
  }
}

/**
 * 浏览器支持降级提示 banner。
 *
 * 用法:`<BrowserSupportBanner client:only="react" />`
 * 放在 PlaygroundLayout 顶部,与 OfflineIndicator 同层级。
 */
export default function BrowserSupportBanner() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [items, setItems] = useState<BannerItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<BannerKind>>(new Set());

  useEffect(() => {
    // 仅在浏览器环境执行(SSR 安全)
    if (typeof navigator === 'undefined') return;

    const info = detectBrowserInfo();
    const caps = detectBrowserCapabilities();
    const allBanners = computeBanners(info.isFirefox, caps);
    const already = readDismissed();
    // 过滤掉已 dismiss 的
    const visible = allBanners.filter((b) => !already.has(b.kind));
    setItems(visible);
    setDismissed(already);
  }, []);

  // 按 BANNER_ORDER 排序(严重在前)
  const sortedItems = [...items].sort(
    (a, b) => BANNER_ORDER.indexOf(a.kind) - BANNER_ORDER.indexOf(b.kind)
  );

  // 单条 dismiss:更新 state + sessionStorage
  const dismiss = (kind: BannerKind) => {
    const next = new Set(dismissed);
    next.add(kind);
    setDismissed(next);
    writeDismissed(next);
    setItems((prev) => prev.filter((b) => b.kind !== kind));
  };

  if (sortedItems.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed left-0 right-0 top-0 z-30 flex flex-col"
    >
      {sortedItems.map((item) => (
        <div
          key={item.kind}
          className="flex items-center justify-between gap-3 border-b border-amber-800 bg-amber-950/85 px-4 py-2 text-amber-200 backdrop-blur"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400"
              aria-hidden
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[12px] font-semibold text-amber-100">
                {t(item.titleKey)}
              </span>
              <span className="text-[11px] text-amber-300/80">
                {t(item.msgKey)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(item.kind)}
            className="flex-shrink-0 rounded px-2 py-1 text-[10px] font-medium text-amber-300/80 transition-colors hover:bg-amber-900/60 hover:text-amber-100"
            aria-label={t('browserSupport.dismiss')}
          >
            {t('browserSupport.dismiss')}
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * BrowserSupportBanner 工具函数(W22.4)
 *
 * 从 React 组件中抽出纯逻辑,便于在不依赖 React / i18n alias 的环境下单测。
 */
import type { BrowserCapabilities } from '@lokvis/runtime';

/** 提示类型(按严重度排序,严重在前) */
export type BannerKind = 'firefox' | 'opfs-missing' | 'offscreen-canvas-missing';

/** 单条提示数据 */
export interface BannerItem {
  kind: BannerKind;
  titleKey: string;
  msgKey: string;
}

/** 严重度排序(数组顺序即显示顺序) */
export const BANNER_ORDER: BannerKind[] = [
  'firefox',
  'opfs-missing',
  'offscreen-canvas-missing',
];

/**
 * 据能力探测结果计算需要显示的提示列表。
 *
 * 规则:
 * - Firefox 浏览器:显示总体受限提示(即使能力齐备,也提醒用户体验非最优)
 * - OPFS 不可用且非 Firefox(Firefox 已被上面覆盖):单独提示 IndexedDB 降级
 * - OffscreenCanvas 不可用:提示 HTMLCanvas 降级(主线程阻塞风险)
 *
 * 不显示的条件:
 * - Chrome/Edge/Safari 且能力齐备 → 返回空数组
 * - SSR 环境(detectBrowserCapabilities 在 Node 下全 false,但也不会弹 Firefox
 *   提示,因为 detectBrowserInfo.name === 'unknown')
 */
export function computeBanners(
  isFirefox: boolean,
  caps: BrowserCapabilities
): BannerItem[] {
  const items: BannerItem[] = [];

  if (isFirefox) {
    items.push({
      kind: 'firefox',
      titleKey: 'browserSupport.firefoxTitle',
      msgKey: 'browserSupport.firefoxMsg',
    });
    // Firefox 已有总体提示,不再单独弹 OPFS / OffscreenCanvas 子项
    // (避免叠加多条提示造成视觉污染)
    return items;
  }

  // 非 Firefox 浏览器,按能力缺失单独提示
  if (!caps.opfs) {
    items.push({
      kind: 'opfs-missing',
      titleKey: 'browserSupport.opfsMissingTitle',
      msgKey: 'browserSupport.opfsMissingMsg',
    });
  }

  if (!caps.offscreenCanvas) {
    items.push({
      kind: 'offscreen-canvas-missing',
      titleKey: 'browserSupport.offscreenCanvasMissingTitle',
      msgKey: 'browserSupport.offscreenCanvasMissingMsg',
    });
  }

  return items;
}

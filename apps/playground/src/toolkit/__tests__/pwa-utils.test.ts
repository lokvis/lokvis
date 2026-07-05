/**
 * W15.4 + W15.5 — pwa-utils 单元测试
 *
 * 覆盖:
 *   - isStandalone: iOS standalone / Chrome standalone / 普通浏览器
 *   - isIosSafari: iOS Safari / Chrome iOS / 非 iOS
 *   - isDismissedInCooldown: 无记录 / 冷却期内 / 冷却期外
 *   - markDismissed / clearDismissed: 写入 / 清除 / 隐私模式兜底
 *   - isOnline: 默认在线 / navigator.onLine=false 离线
 *   - subscribeOnlineStatus: online / offline 事件触发 + 取消订阅
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isStandalone,
  isIosSafari,
  isDismissedInCooldown,
  markDismissed,
  clearDismissed,
  isOnline,
  subscribeOnlineStatus,
  DISMISS_KEY,
  DISMISS_COOLDOWN_MS,
} from '../pwa-utils.js';

describe('pwa-utils (W15.4 + W15.5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isStandalone', () => {
    it('普通浏览器(无 standalone 标记)返回 false', () => {
      // jsdom 默认 matchMedia 不存在,需 stub
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
      delete (window.navigator as Navigator & { standalone?: boolean })
        .standalone;
      expect(isStandalone()).toBe(false);
      window.matchMedia = original;
    });

    it('iOS standalone 模式(navigator.standalone=true)返回 true', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: true,
        configurable: true,
      });
      expect(isStandalone()).toBe(true);
      delete (window.navigator as Navigator & { standalone?: boolean })
        .standalone;
    });

    it('Chrome standalone 模式(display-mode: standalone matches)返回 true', () => {
      const original = window.matchMedia;
      window.matchMedia = vi
        .fn()
        .mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        })) as never;
      expect(isStandalone()).toBe(true);
      window.matchMedia = original;
    });
  });

  describe('isIosSafari', () => {
    afterEach(() => {
      // 还原 UA
      Object.defineProperty(window.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });
    });

    it('iOS Safari UA 返回 true', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        configurable: true,
      });
      expect(isIosSafari()).toBe(true);
    });

    it('Chrome iOS UA(CriOS)返回 false(走 beforeinstallprompt 流程)', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
        configurable: true,
      });
      expect(isIosSafari()).toBe(false);
    });

    it('Desktop Chrome UA 返回 false', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });
      expect(isIosSafari()).toBe(false);
    });
  });

  describe('dismiss cooldown', () => {
    it('无 dismiss 记录时返回 false', () => {
      expect(isDismissedInCooldown(1000)).toBe(false);
    });

    it('dismiss 时间戳在 7 天内返回 true', () => {
      const now = 10_000_000;
      const dismissedAt = now - 1000; // 1 秒前
      localStorage.setItem(DISMISS_KEY, String(dismissedAt));
      expect(isDismissedInCooldown(now)).toBe(true);
    });

    it('dismiss 时间戳超过 7 天返回 false', () => {
      const now = 10_000_000;
      const dismissedAt = now - DISMISS_COOLDOWN_MS - 1; // 7 天 + 1ms 前
      localStorage.setItem(DISMISS_KEY, String(dismissedAt));
      expect(isDismissedInCooldown(now)).toBe(false);
    });

    it('markDismissed 写入当前时间戳(7 天内会被判定为冷却中)', () => {
      const now = 5_000_000;
      markDismissed(now);
      expect(localStorage.getItem(DISMISS_KEY)).toBe(String(now));
      expect(isDismissedInCooldown(now + 1000)).toBe(true);
    });

    it('clearDismissed 清除记录', () => {
      markDismissed(1_000_000);
      expect(localStorage.getItem(DISMISS_KEY)).not.toBeNull();
      clearDismissed();
      expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    });

    it('localStorage 不可用时不抛错', () => {
      // 模拟 localStorage 抛错(隐私模式)
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('Access denied');
        },
        configurable: true,
      });
      expect(() => isDismissedInCooldown()).not.toThrow();
      expect(() => markDismissed()).not.toThrow();
      expect(() => clearDismissed()).not.toThrow();
      // 还原
      if (original) {
        Object.defineProperty(window, 'localStorage', original);
      }
    });
  });

  describe('isOnline', () => {
    it('默认 navigator.onLine=true 时返回 true', () => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: true,
        configurable: true,
      });
      expect(isOnline()).toBe(true);
    });

    it('navigator.onLine=false 时返回 false', () => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      expect(isOnline()).toBe(false);
    });
  });

  describe('subscribeOnlineStatus', () => {
    it('online 事件触发回调(true)', () => {
      const cb = vi.fn();
      const unsub = subscribeOnlineStatus(cb);
      window.dispatchEvent(new Event('online'));
      expect(cb).toHaveBeenCalledWith(true);
      unsub();
    });

    it('offline 事件触发回调(false)', () => {
      const cb = vi.fn();
      const unsub = subscribeOnlineStatus(cb);
      window.dispatchEvent(new Event('offline'));
      expect(cb).toHaveBeenCalledWith(false);
      unsub();
    });

    it('取消订阅后不再触发回调', () => {
      const cb = vi.fn();
      const unsub = subscribeOnlineStatus(cb);
      unsub();
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('offline'));
      expect(cb).not.toHaveBeenCalled();
    });
  });
});

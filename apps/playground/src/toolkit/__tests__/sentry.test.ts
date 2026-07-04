/**
 * Sentry 监控接入单测(W12.3,PR #14 Review 重写)
 *
 * Review 修复:
 * - 原 12 个测试均为 no-op 边界(DSN='' 早返回),核心逻辑零覆盖
 * - 现通过 vi.mock('@sentry/browser') + vi.stubEnv 注入 DSN,覆盖 26 个测试:
 *   1. shouldEnableSentry 四条路径(DSN 空 / DSN 配置 / DNT / GPC)
 *   2. initSentry 成功路径(Sentry.init 调用参数 dsn/release)
 *   3. initSentry 幂等性(只 init 一次)
 *   4. initSentry 失败降级(init 抛错 → catch + warn + 后续 API 走降级)
 *   5. beforeBreadcrumb 隐私过滤(ui.click / ui.input / fetch / xhr / console / ui.key redact message+data;navigation 原样返回)
 *   6. beforeSend URL 脱敏(剥离 query / 剥离 hash / 非标准 URL redact / 无 URL 原样返回)
 *   7. captureException / captureMessage / setAnonymousUser 在初始化后调用 SDK,未初始化时降级
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock @sentry/browser,所有测试共享同一 mock 实例
const mockSentryInit = vi.fn();
const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();
const mockSetUser = vi.fn();

// 保留 init options 供测试断言 beforeBreadcrumb / beforeSend
// 用一个稳定容器对象避免 capturedOptions 引用丢失(模块闭包 vs 测试闭包)
const captured: {
  options: {
    beforeBreadcrumb?: (b: { category?: string; message?: string; data?: unknown }) => unknown;
    beforeSend?: (e: { request?: { url?: string } }) => unknown;
    dsn?: string;
    release?: string;
  };
} = { options: {} };

vi.mock('@sentry/browser', () => ({
  init: (opts: typeof captured.options) => {
    captured.options = opts;
    mockSentryInit(opts);
  },
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  setUser: mockSetUser,
}));

import {
  shouldEnableSentry,
  initSentry,
  captureException,
  captureMessage,
  setAnonymousUser,
  _resetSentryForTesting,
} from '../sentry.js';

describe('Sentry 监控接入(W12.3)', () => {
  beforeEach(() => {
    _resetSentryForTesting();
    mockSentryInit.mockClear();
    mockCaptureException.mockClear();
    mockCaptureMessage.mockClear();
    mockSetUser.mockClear();
    captured.options = {};
    // 默认配置 DSN,使测试可走真实初始化路径
    vi.stubEnv('PUBLIC_SENTRY_DSN', 'https://test@sentry.example/1');
    // 清除 navigator 上的 DNT / GPC 痕迹
    Object.defineProperty(navigator, 'doNotTrack', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: undefined,
      configurable: true,
    });
  });

  afterEach(() => {
    _resetSentryForTesting();
    vi.unstubAllEnvs();
    // 注意:不能用 vi.restoreAllMocks(),会还原 vi.fn() 创建的 mock 实现,
    // 导致 mockSentryInit / mockCaptureException 等变为空 mock,后续测试失效。
    // 改用 mockClear() 仅清调用记录,保留实现(在 beforeEach 中已逐个 clear)。
  });

  describe('shouldEnableSentry', () => {
    it('DSN 未配置时返回 false', () => {
      vi.stubEnv('PUBLIC_SENTRY_DSN', '');
      expect(shouldEnableSentry()).toBe(false);
    });

    it('DSN 配置 + 无 DNT/GPC 时返回 true', () => {
      expect(shouldEnableSentry()).toBe(true);
    });

    it('用户启用 DNT 时返回 false', () => {
      Object.defineProperty(navigator, 'doNotTrack', {
        value: '1',
        configurable: true,
      });
      expect(shouldEnableSentry()).toBe(false);
    });

    it('用户启用 GPC(globalPrivacyControl)时返回 false', () => {
      Object.defineProperty(navigator, 'globalPrivacyControl', {
        value: true,
        configurable: true,
      });
      expect(shouldEnableSentry()).toBe(false);
    });
  });

  describe('initSentry', () => {
    it('DSN 未配置时为 no-op,不加载 SDK', async () => {
      vi.stubEnv('PUBLIC_SENTRY_DSN', '');
      await initSentry();
      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('DSN 配置时调用 Sentry.init 并传入 dsn/release', async () => {
      await initSentry();
      expect(mockSentryInit).toHaveBeenCalledTimes(1);
      const call = mockSentryInit.mock.calls[0]![0] as { dsn: string; release: string };
      expect(call.dsn).toBe('https://test@sentry.example/1');
      expect(call.release).toBe('playground@0.1.0');
    });

    it('重复调用 initSentry 幂等(只 init 一次)', async () => {
      await initSentry();
      await initSentry();
      await initSentry();
      expect(mockSentryInit).toHaveBeenCalledTimes(1);
    });

    it('Sentry.init 抛错时 catch + warn,不抛错', async () => {
      // 让 mock 的 init 抛错(模拟 SDK 初始化失败,等价于 import + init 链路失败的 catch 分支)
      mockSentryInit.mockImplementationOnce(() => {
        throw new Error('init exploded');
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(initSentry()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        '[sentry] init failed, playground will continue without monitoring:',
        expect.any(Error)
      );
      // 失败后 initialized 仍为 false,后续 captureException 走 console.error 降级
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      captureException(new Error('after-fail'));
      expect(errorSpy).toHaveBeenCalledWith(
        '[sentry-disabled] captured exception:',
        expect.any(Error),
        undefined
      );
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('beforeBreadcrumb 隐私过滤', () => {
    it('ui.click breadcrumb 的 message 与 data 同时被 redact', async () => {
      await initSentry();
      const beforeBreadcrumb = captured.options.beforeBreadcrumb!;
      const result = beforeBreadcrumb({
        category: 'ui.click',
        message: 'clicked secret.png',
        data: { target: 'button', element: 'secret.png' },
      }) as { message: string; data: unknown };
      expect(result.message).toBe('[redacted]');
      expect(result.data).toBeUndefined();
    });

    it('ui.input breadcrumb 也被 redact', async () => {
      await initSentry();
      const beforeBreadcrumb = captured.options.beforeBreadcrumb!;
      const result = beforeBreadcrumb({
        category: 'ui.input',
        message: 'typed password',
        data: { value: 'pwd' },
      }) as { message: string; data: unknown };
      expect(result.message).toBe('[redacted]');
      expect(result.data).toBeUndefined();
    });

    it('fetch / xhr / console / ui.key 类别也被 redact(扩展过滤范围)', async () => {
      await initSentry();
      const beforeBreadcrumb = captured.options.beforeBreadcrumb!;
      for (const cat of ['fetch', 'xhr', 'console', 'ui.key']) {
        const result = beforeBreadcrumb({
          category: cat,
          message: 'sensitive data',
          data: { url: 'http://example.com/secret.png' },
        }) as { message: string; data: unknown };
        expect(result.message).toBe('[redacted]');
        expect(result.data).toBeUndefined();
      }
    });

    it('navigation 等非敏感类别原样返回', async () => {
      await initSentry();
      const beforeBreadcrumb = captured.options.beforeBreadcrumb!;
      const result = beforeBreadcrumb({
        category: 'navigation',
        message: '/playground/image',
        data: { from: '/' },
      }) as { message: string; data: unknown };
      expect(result.message).toBe('/playground/image');
      expect(result.data).toEqual({ from: '/' });
    });
  });

  describe('beforeSend URL 脱敏', () => {
    it('剥离 ?workflow=<base64> 查询参数,仅保留 origin + pathname', async () => {
      await initSentry();
      const beforeSend = captured.options.beforeSend!;
      const result = beforeSend({
        request: {
          url: 'https://playground.lokvis.dev/image?workflow=eyJub2RlcyI6W119',
        },
      }) as { request: { url: string } };
      expect(result.request.url).toBe('https://playground.lokvis.dev/image');
    });

    it('剥离 hash 片段', async () => {
      await initSentry();
      const beforeSend = captured.options.beforeSend!;
      const result = beforeSend({
        request: { url: 'https://playground.lokvis.dev/image#section' },
      }) as { request: { url: string } };
      expect(result.request.url).toBe('https://playground.lokvis.dev/image');
    });

    it('非标准 URL 整段 redact', async () => {
      await initSentry();
      const beforeSend = captured.options.beforeSend!;
      const result = beforeSend({
        request: { url: 'not-a-valid-url' },
      }) as { request: { url: string } };
      expect(result.request.url).toBe('[redacted-url]');
    });

    it('无 URL 时原样返回', async () => {
      await initSentry();
      const beforeSend = captured.options.beforeSend!;
      const result = beforeSend({ request: {} }) as { request: {} };
      expect(result.request).toEqual({});
    });
  });

  describe('captureException', () => {
    it('初始化后调用 Sentry SDK captureException 并传入 extra', async () => {
      await initSentry();
      const err = new Error('boom');
      captureException(err, { context: 'demo' });
      expect(mockCaptureException).toHaveBeenCalledTimes(1);
      expect(mockCaptureException).toHaveBeenCalledWith(err, {
        extra: { context: 'demo' },
      });
    });

    it('未初始化时退化为 console.error', () => {
      vi.stubEnv('PUBLIC_SENTRY_DSN', '');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('test');
      captureException(err, { ctx: 1 });
      expect(errorSpy).toHaveBeenCalledWith(
        '[sentry-disabled] captured exception:',
        err,
        { ctx: 1 }
      );
      expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it('接受任意错误类型(string / Error / object)', async () => {
      await initSentry();
      captureException('string error');
      captureException({ code: 'CUSTOM', msg: 'object' });
      expect(mockCaptureException).toHaveBeenCalledTimes(2);
    });
  });

  describe('captureMessage', () => {
    it('初始化后调用 Sentry SDK captureMessage 传入 level', async () => {
      await initSentry();
      captureMessage('degradation triggered', 'warning');
      expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'degradation triggered',
        'warning'
      );
    });

    it('未初始化 + info 级别不打印', () => {
      vi.stubEnv('PUBLIC_SENTRY_DSN', '');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      captureMessage('info msg', 'info');
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('未初始化 + error 级别走 console.error', () => {
      vi.stubEnv('PUBLIC_SENTRY_DSN', '');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      captureMessage('error msg', 'error');
      expect(errorSpy).toHaveBeenCalledWith('[sentry-disabled]', 'error msg');
    });

    it('默认级别 info 不打印', () => {
      vi.stubEnv('PUBLIC_SENTRY_DSN', '');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      captureMessage('default');
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('setAnonymousUser', () => {
    it('初始化后调用 Sentry SDK setUser', async () => {
      await initSentry();
      setAnonymousUser('user-123');
      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith({
        id: 'user-123',
        username: 'anonymous',
      });
    });

    it('未初始化时为 no-op(不抛错)', () => {
      vi.stubEnv('PUBLIC_SENTRY_DSN', '');
      expect(() => setAnonymousUser('user-123')).not.toThrow();
      expect(mockSetUser).not.toHaveBeenCalled();
    });
  });

  describe('模块导出', () => {
    it('所有 API 是函数', () => {
      expect(typeof shouldEnableSentry).toBe('function');
      expect(typeof initSentry).toBe('function');
      expect(typeof captureException).toBe('function');
      expect(typeof captureMessage).toBe('function');
      expect(typeof setAnonymousUser).toBe('function');
      expect(typeof _resetSentryForTesting).toBe('function');
    });
  });
});

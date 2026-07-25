/**
 * ErrorBoundary 单测(@lokvis/embed-pdf)。
 *
 * 覆盖:
 *   - 捕获子组件渲染错误并展示 fallback
 *   - 自定义 fallback 函数
 *   - 重试逻辑(MAX_RETRY=3 后隐藏按钮)
 *   - locale prop 影响错误文案语言
 *   - captureException 被调用
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { EmbedPdfI18nProvider } from '../i18n/EmbedPdfI18nProvider';

// mock captureException
vi.mock('../internal/sentry', () => ({
  captureException: vi.fn(),
}));

import { captureException } from '../internal/sentry';

// 会抛错的子组件
function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test render error');
  return <div data-testid="child">正常内容</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 抑制 React 错误边界的 console.error 输出
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('子组件无错误时正常渲染', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child').textContent).toBe('正常内容');
  });

  it('捕获渲染错误并展示默认 fallback', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>
    );
    // 默认英文 fallback
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText(/Error has been logged/)).toBeTruthy();
  });

  it('错误信息包含原始 error.message', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('test render error')).toBeTruthy();
  });

  it('调用 captureException 上报错误', () => {
    render(
      <ErrorBoundary>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ errorBoundary: 'ErrorBoundary' })
    );
  });

  it('自定义 fallback 函数被使用', () => {
    const fallback = vi.fn((error: Error, _reset: () => void) => (
      <div data-testid="custom-fallback">{error.message}</div>
    ));
    render(
      <ErrorBoundary fallback={fallback}>
        <Thrower shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('custom-fallback').textContent).toBe('test render error');
    expect(fallback).toHaveBeenCalled();
  });

  it('重试按钮点击后恢复子组件渲染', () => {
    let shouldThrow = true;
    function ConditionalThrower() {
      if (shouldThrow) throw new Error('boom');
      return <div data-testid="recovered">恢复了</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );
    // 错误态
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    // 修复错误后点重试
    shouldThrow = false;
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByTestId('recovered').textContent).toBe('恢复了');
  });

  it('locale prop 影响错误文案语言', () => {
    render(
      <ErrorBoundary locale="zh">
        <Thrower shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('出错了')).toBeTruthy();
    expect(screen.getByText('重试')).toBeTruthy();
  });

  it('Provider locale 影响错误文案语言', () => {
    render(
      <EmbedPdfI18nProvider locale="ja">
        <ErrorBoundary>
          <Thrower shouldThrow={true} />
        </ErrorBoundary>
      </EmbedPdfI18nProvider>
    );
    expect(screen.getByText('エラーが発生しました')).toBeTruthy();
  });

  it('超过 MAX_RETRY 次后隐藏重试按钮', () => {
    // 始终抛错的组件(显式标注返回类型以满足 JSX 组件约束)
    function AlwaysThrows(): ReactElement {
      throw new Error('always fails');
    }

    render(
      <ErrorBoundary>
        <AlwaysThrows />
      </ErrorBoundary>
    );

    // 第一次错误:retryCount=1(componentDidCatch 后),按钮可见
    expect(screen.getByText('Retry')).toBeTruthy();

    // 点击重试 → 再次抛错 → retryCount=2
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('Retry')).toBeTruthy();

    // 点击重试 → 再次抛错 → retryCount=3
    fireEvent.click(screen.getByText('Retry'));
    // retryCount=3 >= MAX_RETRY,按钮隐藏
    expect(screen.queryByText('Retry')).toBeNull();
    // 显示 retryExceeded 文案
    expect(screen.getByText(/Please refresh the page/)).toBeTruthy();
  });
});

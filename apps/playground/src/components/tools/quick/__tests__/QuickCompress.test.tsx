/**
 * QuickCompress 原语(Layer 1)单测。
 *
 * 测试覆盖:
 *   - 不在 Root 内使用时抛错(context 校验)
 *   - Root 渲染 children
 *   - Upload 渲染 + ARIA + 拖拽行为
 *   - PresetSwitcher 渲染 3 个按钮 + ARIA radiogroup
 *   - Preview 渲染图片或占位
 *   - RatioBadge 渲染(有/无输出)
 *   - DownloadButton 渲染(有/无输出)
 *   - ErrorDisplay 渲染(有/无错误)
 *   - ResetButton 渲染 + 禁用态
 *
 * useImageTool 被整体 mock,只验证原语渲染与交互。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';
import { QuickCompress } from '../primitives/QuickCompress';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('@/components/toolkit/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

const runWorkflowMock = vi.fn();
const runWorkflowRawMock = vi.fn();
const handleFilesMock = vi.fn();
const resetMock = vi.fn();
const clearErrorMock = vi.fn();

function setMockState(overrides: Partial<UseImageToolResult> = {}) {
  stateRef.current = {
    runtime: null,
    ready: true,
    initError: null,
    inputId: null,
    inputUrl: null,
    inputInfo: null,
    outputBlob: null,
    outputUrl: null,
    outputInfo: null,
    busy: false,
    error: null,
    handleFiles: handleFilesMock,
    runWorkflow: runWorkflowMock,
    runWorkflowRaw: runWorkflowRawMock,
    reset: resetMock,
    clearError: clearErrorMock,
    ...overrides,
  };
}

function resetMocks() {
  runWorkflowMock.mockReset();
  runWorkflowRawMock.mockReset();
  handleFilesMock.mockReset();
  resetMock.mockReset();
  clearErrorMock.mockReset();
}

// ─── 测试 ───────────────────────────────────────────────────

describe('QuickCompress 原语', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Root', () => {
    it('渲染 children', () => {
      render(
        <QuickCompress.Root>
          <div>hello</div>
        </QuickCompress.Root>
      );
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });

  describe('Upload', () => {
    it('不在 Root 内使用时抛错', () => {
      // 抑制 console.error(React 会在抛错前调用)
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<QuickCompress.Upload />)).toThrow(/QuickCompress primitives/);
      spy.mockRestore();
    });

    it('渲染默认 children', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.Upload>点击上传</QuickCompress.Upload>
        </QuickCompress.Root>
      );
      expect(screen.getByText('点击上传')).toBeInTheDocument();
    });

    it('具有 button role 与 ARIA label', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.Upload aria-label="上传图片">上传</QuickCompress.Upload>
        </QuickCompress.Root>
      );
      const btn = screen.getByRole('button', { name: '上传图片' });
      expect(btn).toBeInTheDocument();
    });

    it('点击触发 file input', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.Upload>点击</QuickCompress.Upload>
        </QuickCompress.Root>
      );
      const btn = screen.getByRole('button');
      // input 应存在(隐藏)
      const input = document.querySelector('input[type=file]') as HTMLInputElement;
      expect(input).not.toBeNull();
      // 点击按钮不会出错
      expect(() => fireEvent.click(btn)).not.toThrow();
    });

    it('drop 文件触发 handleFiles', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.Upload>上传</QuickCompress.Upload>
        </QuickCompress.Root>
      );
      const btn = screen.getByRole('button');
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      fireEvent.drop(btn, {
        dataTransfer: { files: [file] },
      });
      expect(handleFilesMock).toHaveBeenCalled();
    });
  });

  describe('PresetSwitcher', () => {
    it('渲染 3 个 radio 按钮(balanced/highQuality/small)', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.PresetSwitcher />
        </QuickCompress.Root>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(screen.getByText('balanced')).toBeInTheDocument();
      expect(screen.getByText('highQuality')).toBeInTheDocument();
      expect(screen.getByText('small')).toBeInTheDocument();
    });

    it('默认 balanced 为选中态(aria-checked=true)', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.PresetSwitcher />
        </QuickCompress.Root>
      );
      const balanced = screen.getByText('balanced').closest('button')!;
      expect(balanced).toHaveAttribute('aria-checked', 'true');
    });

    it('点击 highQuality 切换选中态', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.PresetSwitcher />
        </QuickCompress.Root>
      );
      fireEvent.click(screen.getByText('highQuality'));
      const highQ = screen.getByText('highQuality').closest('button')!;
      expect(highQ).toHaveAttribute('aria-checked', 'true');
    });

    it('支持自定义 renderButton', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.PresetSwitcher
            renderButton={(preset, isSelected) => (
              <span data-testid={`preset-${preset}`} data-selected={isSelected}>
                {preset}
              </span>
            )}
          />
        </QuickCompress.Root>
      );
      expect(screen.getByTestId('preset-balanced')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('preset-small')).toHaveAttribute('data-selected', 'false');
    });
  });

  describe('Preview', () => {
    it('无 url 时渲染占位', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.Preview type="output" placeholder="无图片" />
        </QuickCompress.Root>
      );
      expect(screen.getByText('无图片')).toBeInTheDocument();
    });

    it('有 url 时渲染 <img>', () => {
      setMockState({ outputUrl: 'blob:output-1' });
      render(
        <QuickCompress.Root>
          <QuickCompress.Preview type="output" alt="输出图片" />
        </QuickCompress.Root>
      );
      const img = screen.getByAltText('输出图片');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'blob:output-1');
    });

    it('有 info 时显示尺寸信息', () => {
      setMockState({
        inputUrl: 'blob:input-1',
        inputInfo: { width: 800, height: 600, size: 1024, format: 'PNG' },
      });
      render(
        <QuickCompress.Root>
          <QuickCompress.Preview type="input" />
        </QuickCompress.Root>
      );
      expect(screen.getByText(/800×600/)).toBeInTheDocument();
    });
  });

  describe('RatioBadge', () => {
    it('无输出时不渲染', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.RatioBadge />
        </QuickCompress.Root>
      );
      // 没有内容渲染
      const container = document.querySelector('[role=status]');
      expect(container).toBeNull();
    });

    it('有输出时渲染压缩率(status role)', () => {
      setMockState({
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
        outputInfo: { width: 800, height: 600, size: 300, format: 'WEBP' },
      });
      render(
        <QuickCompress.Root>
          <QuickCompress.RatioBadge />
        </QuickCompress.Root>
      );
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent(/Saved/);
      expect(badge).toHaveTextContent(/70.0%/);
    });

    it('支持自定义 format 函数', () => {
      setMockState({
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
        outputInfo: { width: 800, height: 600, size: 300, format: 'WEBP' },
      });
      render(
        <QuickCompress.Root>
          <QuickCompress.RatioBadge format={(r) => `压缩率:${r.toFixed(1)}%`} />
        </QuickCompress.Root>
      );
      expect(screen.getByRole('status')).toHaveTextContent('压缩率:70.0%');
    });
  });

  describe('DownloadButton', () => {
    it('无 outputBlob 时不渲染', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.DownloadButton>下载</QuickCompress.DownloadButton>
        </QuickCompress.Root>
      );
      expect(screen.queryByText('下载')).toBeNull();
    });

    it('有 outputBlob 时渲染按钮', () => {
      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <QuickCompress.Root>
          <QuickCompress.DownloadButton>下载</QuickCompress.DownloadButton>
        </QuickCompress.Root>
      );
      expect(screen.getByText('下载')).toBeInTheDocument();
    });
  });

  describe('ErrorDisplay', () => {
    it('无错误时不渲染', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.ErrorDisplay />
        </QuickCompress.Root>
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('有 error 时渲染(alert role)', () => {
      setMockState({ error: 'compress failed' });
      render(
        <QuickCompress.Root>
          <QuickCompress.ErrorDisplay />
        </QuickCompress.Root>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('compress failed');
    });

    it('initError 也会显示', () => {
      setMockState({ initError: 'runtime init failed' });
      render(
        <QuickCompress.Root>
          <QuickCompress.ErrorDisplay />
        </QuickCompress.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('runtime init failed');
    });
  });

  describe('ResetButton', () => {
    it('无输入时禁用(disabledWhenEmpty=true 默认)', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.ResetButton>重置</QuickCompress.ResetButton>
        </QuickCompress.Root>
      );
      expect(screen.getByText('重置')).toBeDisabled();
    });

    it('有输入时启用,点击触发 reset', () => {
      setMockState({ inputUrl: 'blob:input-1' });
      render(
        <QuickCompress.Root>
          <QuickCompress.ResetButton>重置</QuickCompress.ResetButton>
        </QuickCompress.Root>
      );
      const btn = screen.getByText('重置');
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(resetMock).toHaveBeenCalledTimes(1);
    });

    it('disabledWhenEmpty=false 时无输入也可点击', () => {
      render(
        <QuickCompress.Root>
          <QuickCompress.ResetButton disabledWhenEmpty={false}>重置</QuickCompress.ResetButton>
        </QuickCompress.Root>
      );
      expect(screen.getByText('重置')).not.toBeDisabled();
    });
  });
});

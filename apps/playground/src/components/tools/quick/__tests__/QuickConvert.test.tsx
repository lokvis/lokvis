/**
 * QuickConvert 原语(Layer 1)单测。
 *
 * 测试覆盖:
 *   - 不在 Root 内使用时抛错
 *   - Root 渲染 children
 *   - Upload 渲染 + ARIA + 拖拽
 *   - PresetSwitcher 渲染 4 个按钮 + radiogroup
 *   - Preview 渲染图片或占位
 *   - FormatBadge 渲染(有/无输出)
 *   - DownloadButton 渲染(有/无输出)
 *   - ErrorDisplay 渲染(有/无错误)
 *   - ResetButton 渲染 + 禁用态
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';
import { QuickConvert } from '../primitives/QuickConvert';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('@/components/toolkit/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

const runWorkflowMock = vi.fn();
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
    reset: resetMock,
    clearError: clearErrorMock,
    ...overrides,
  };
}

function resetMocks() {
  runWorkflowMock.mockReset();
  handleFilesMock.mockReset();
  resetMock.mockReset();
  clearErrorMock.mockReset();
}

describe('QuickConvert 原语', () => {
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
        <QuickConvert.Root>
          <div>hello</div>
        </QuickConvert.Root>
      );
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });

  describe('Upload', () => {
    it('不在 Root 内使用时抛错', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<QuickConvert.Upload />)).toThrow(
        /必须包裹在 <QuickConvert.Root> 内/
      );
      spy.mockRestore();
    });

    it('渲染 role=button + aria-label', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.Upload aria-label="Pick image" />
        </QuickConvert.Root>
      );
      const btn = screen.getByRole('button', { name: 'Pick image' });
      expect(btn).toBeInTheDocument();
    });

    it('busy 时 aria-disabled=true', () => {
      setMockState({ busy: true });
      render(
        <QuickConvert.Root>
          <QuickConvert.Upload />
        </QuickConvert.Root>
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-disabled', 'true');
    });

    it('函数 children 接收 isDragging 状态', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.Upload>{({ isDragging }) => <span>{isDragging ? 'dragging' : 'idle'}</span>}</QuickConvert.Upload>
        </QuickConvert.Root>
      );
      expect(screen.getByText('idle')).toBeInTheDocument();
    });
  });

  describe('PresetSwitcher', () => {
    it('渲染 4 个 radio 按钮(默认预设顺序)', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.PresetSwitcher />
        </QuickConvert.Root>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);
    });

    it('外层为 radiogroup', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.PresetSwitcher />
        </QuickConvert.Root>
      );
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('当前 preset 对应的 radio aria-checked=true', () => {
      render(
        <QuickConvert.Root initialPreset="avif">
          <QuickConvert.PresetSwitcher />
        </QuickConvert.Root>
      );
      const radios = screen.getAllByRole('radio');
      const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
      expect(checked).toHaveLength(1);
    });
  });

  describe('Preview', () => {
    it('无图片时渲染 placeholder', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.Preview type="input" placeholder="empty" />
        </QuickConvert.Root>
      );
      expect(screen.getByText('empty')).toBeInTheDocument();
    });

    it('有图片时渲染 <img>', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickConvert.Root>
          <QuickConvert.Preview type="input" />
        </QuickConvert.Root>
      );
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'blob:input');
    });

    it('有 inputInfo 时渲染格式信息', () => {
      setMockState({
        inputUrl: 'blob:input',
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
      });
      render(
        <QuickConvert.Root>
          <QuickConvert.Preview type="input" />
        </QuickConvert.Root>
      );
      expect(screen.getByText(/PNG/)).toBeInTheDocument();
    });
  });

  describe('FormatBadge', () => {
    it('无输出时不渲染', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.FormatBadge />
        </QuickConvert.Root>
      );
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('有 input + output 时渲染 role=status', () => {
      setMockState({
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
      });
      render(
        <QuickConvert.Root>
          <QuickConvert.FormatBadge />
        </QuickConvert.Root>
      );
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('PNG → WEBP');
    });

    it('自定义 format 函数', () => {
      setMockState({
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
      });
      render(
        <QuickConvert.Root>
          <QuickConvert.FormatBadge format={(i, o) => `from ${i} to ${o}`} />
        </QuickConvert.Root>
      );
      expect(screen.getByRole('status')).toHaveTextContent('from PNG to WEBP');
    });
  });

  describe('DownloadButton', () => {
    it('无输出时不渲染', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.DownloadButton />
        </QuickConvert.Root>
      );
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('有输出时渲染 button', () => {
      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <QuickConvert.Root>
          <QuickConvert.DownloadButton>下载</QuickConvert.DownloadButton>
        </QuickConvert.Root>
      );
      expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument();
    });

    it('点击触发 downloadBlob', () => {
      const createObjectURL = vi.fn(() => 'blob:mock');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(globalThis, 'URL', {
        value: { ...URL, createObjectURL, revokeObjectURL },
        writable: true,
      });
      const clickSpy = vi.fn();
      HTMLAnchorElement.prototype.click = clickSpy;

      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <QuickConvert.Root>
          <QuickConvert.DownloadButton>下载</QuickConvert.DownloadButton>
        </QuickConvert.Root>
      );
      fireEvent.click(screen.getByRole('button', { name: '下载' }));
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('ErrorDisplay', () => {
    it('无错误时不渲染', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.ErrorDisplay />
        </QuickConvert.Root>
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('有 error 时渲染 role=alert', () => {
      setMockState({ error: 'something went wrong' });
      render(
        <QuickConvert.Root>
          <QuickConvert.ErrorDisplay />
        </QuickConvert.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('something went wrong');
    });

    it('有 initError 时也渲染', () => {
      setMockState({ initError: 'runtime init failed' });
      render(
        <QuickConvert.Root>
          <QuickConvert.ErrorDisplay />
        </QuickConvert.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('runtime init failed');
    });
  });

  describe('ResetButton', () => {
    it('无输入且 disabledWhenEmpty=true 时禁用', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.ResetButton />
        </QuickConvert.Root>
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('有输入时启用', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickConvert.Root>
          <QuickConvert.ResetButton />
        </QuickConvert.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('disabledWhenEmpty=false 时始终启用', () => {
      render(
        <QuickConvert.Root>
          <QuickConvert.ResetButton disabledWhenEmpty={false} />
        </QuickConvert.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('点击调用 reset', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickConvert.Root>
          <QuickConvert.ResetButton />
        </QuickConvert.Root>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(resetMock).toHaveBeenCalled();
    });
  });
});

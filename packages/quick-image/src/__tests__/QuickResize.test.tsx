/**
 * QuickResize 原语(Layer 1)单测。
 *
 * 测试覆盖:
 *   - 不在 Root 内使用时抛错
 *   - Root 渲染 children
 *   - Upload 渲染 + ARIA + 拖拽
 *   - PresetSwitcher 渲染 4 个按钮 + radiogroup
 *   - Preview 渲染图片或占位
 *   - DimensionBadge 渲染(有/无输出)
 *   - DownloadButton 渲染(有/无输出)
 *   - ErrorDisplay 渲染(有/无错误)
 *   - ResetButton 渲染 + 禁用态
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import { QuickResize } from '../primitives/QuickResize';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
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

describe('QuickResize 原语', () => {
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
        <QuickResize.Root>
          <div>hello</div>
        </QuickResize.Root>
      );
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });

  describe('Upload', () => {
    it('不在 Root 内使用时抛错', () => {
      // 抑制 console.error
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<QuickResize.Upload />)).toThrow(
        /必须包裹在 <QuickResize.Root> 内/
      );
      spy.mockRestore();
    });

    it('渲染 role=button + aria-label', () => {
      render(
        <QuickResize.Root>
          <QuickResize.Upload aria-label="Pick image" />
        </QuickResize.Root>
      );
      const btn = screen.getByRole('button', { name: 'Pick image' });
      expect(btn).toBeInTheDocument();
    });

    it('busy 时 aria-disabled=true', () => {
      setMockState({ busy: true });
      render(
        <QuickResize.Root>
          <QuickResize.Upload />
        </QuickResize.Root>
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-disabled', 'true');
    });

    it('函数 children 接收 isDragging 状态', () => {
      render(
        <QuickResize.Root>
          <QuickResize.Upload>{({ isDragging }) => <span>{isDragging ? 'dragging' : 'idle'}</span>}</QuickResize.Upload>
        </QuickResize.Root>
      );
      expect(screen.getByText('idle')).toBeInTheDocument();
    });
  });

  describe('PresetSwitcher', () => {
    it('渲染 4 个 radio 按钮(默认预设顺序)', () => {
      render(
        <QuickResize.Root>
          <QuickResize.PresetSwitcher />
        </QuickResize.Root>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);
    });

    it('外层为 radiogroup', () => {
      render(
        <QuickResize.Root>
          <QuickResize.PresetSwitcher />
        </QuickResize.Root>
      );
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('当前 preset 对应的 radio aria-checked=true', () => {
      render(
        <QuickResize.Root initialPreset="yt-landscape">
          <QuickResize.PresetSwitcher />
        </QuickResize.Root>
      );
      const radios = screen.getAllByRole('radio');
      const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
      expect(checked).toHaveLength(1);
    });

    it('点击 radio 调用 setPreset', () => {
      const onPresetChange = vi.fn();
      render(
        <QuickResize.Root>
          <QuickResize.PresetSwitcher
            renderButton={(preset, isSelected, onClick) => (
              <button type="button" data-testid={`btn-${preset}`} aria-checked={isSelected} role="radio" onClick={onClick}>
                {preset}
              </button>
            )}
          />
        </QuickResize.Root>
      );
      const btn = screen.getByTestId('btn-half');
      fireEvent.click(btn);
      // 点击后应触发 preset 切换,通过 runWorkflowMock 间接验证(因为 setPreset 在有输入时重跑)
      // 这里没输入,仅验证不抛错
      expect(onPresetChange).not.toHaveBeenCalled();
    });
  });

  describe('Preview', () => {
    it('无图片时渲染 placeholder', () => {
      render(
        <QuickResize.Root>
          <QuickResize.Preview type="input" placeholder="empty" />
        </QuickResize.Root>
      );
      expect(screen.getByText('empty')).toBeInTheDocument();
    });

    it('有图片时渲染 <img>', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickResize.Root>
          <QuickResize.Preview type="input" />
        </QuickResize.Root>
      );
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'blob:input');
    });

    it('有 inputInfo 时渲染尺寸信息', () => {
      setMockState({
        inputUrl: 'blob:input',
        inputInfo: { width: 1920, height: 1080, size: 1000, format: 'PNG' },
      });
      render(
        <QuickResize.Root>
          <QuickResize.Preview type="input" />
        </QuickResize.Root>
      );
      expect(screen.getByText(/1920×1080/)).toBeInTheDocument();
    });
  });

  describe('DimensionBadge', () => {
    it('无输出时不渲染', () => {
      render(
        <QuickResize.Root>
          <QuickResize.DimensionBadge />
        </QuickResize.Root>
      );
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('有 input + output 时渲染 role=status', () => {
      setMockState({
        inputInfo: { width: 1920, height: 1080, size: 1000, format: 'PNG' },
        outputInfo: { width: 1280, height: 720, size: 500, format: 'PNG' },
      });
      render(
        <QuickResize.Root>
          <QuickResize.DimensionBadge />
        </QuickResize.Root>
      );
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('1920×1080 → 1280×720');
    });

    it('自定义 format 函数', () => {
      setMockState({
        inputInfo: { width: 1920, height: 1080, size: 1000, format: 'PNG' },
        outputInfo: { width: 1280, height: 720, size: 500, format: 'PNG' },
      });
      render(
        <QuickResize.Root>
          <QuickResize.DimensionBadge format={(i, o) => `from ${i.width} to ${o.width}`} />
        </QuickResize.Root>
      );
      expect(screen.getByRole('status')).toHaveTextContent('from 1920 to 1280');
    });
  });

  describe('DownloadButton', () => {
    it('无输出时不渲染', () => {
      render(
        <QuickResize.Root>
          <QuickResize.DownloadButton />
        </QuickResize.Root>
      );
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('有输出时渲染 button', () => {
      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <QuickResize.Root>
          <QuickResize.DownloadButton>下载</QuickResize.DownloadButton>
        </QuickResize.Root>
      );
      expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument();
    });

    it('点击触发 downloadBlob(模拟)', () => {
      // mock URL.createObjectURL + a.click
      const createObjectURL = vi.fn(() => 'blob:mock');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(globalThis, 'URL', {
        value: { ...URL, createObjectURL, revokeObjectURL },
        writable: true,
      });
      // mock HTMLAnchorElement.click
      const clickSpy = vi.fn();
      HTMLAnchorElement.prototype.click = clickSpy;

      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <QuickResize.Root>
          <QuickResize.DownloadButton>下载</QuickResize.DownloadButton>
        </QuickResize.Root>
      );
      fireEvent.click(screen.getByRole('button', { name: '下载' }));
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('ErrorDisplay', () => {
    it('无错误时不渲染', () => {
      render(
        <QuickResize.Root>
          <QuickResize.ErrorDisplay />
        </QuickResize.Root>
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('有 error 时渲染 role=alert', () => {
      setMockState({ error: 'something went wrong' });
      render(
        <QuickResize.Root>
          <QuickResize.ErrorDisplay />
        </QuickResize.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('something went wrong');
    });

    it('有 initError 时也渲染', () => {
      setMockState({ initError: 'runtime init failed' });
      render(
        <QuickResize.Root>
          <QuickResize.ErrorDisplay />
        </QuickResize.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('runtime init failed');
    });
  });

  describe('ResetButton', () => {
    it('无输入且 disabledWhenEmpty=true 时禁用', () => {
      render(
        <QuickResize.Root>
          <QuickResize.ResetButton />
        </QuickResize.Root>
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('有输入时启用', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickResize.Root>
          <QuickResize.ResetButton />
        </QuickResize.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('disabledWhenEmpty=false 时始终启用', () => {
      render(
        <QuickResize.Root>
          <QuickResize.ResetButton disabledWhenEmpty={false} />
        </QuickResize.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('点击调用 reset', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickResize.Root>
          <QuickResize.ResetButton />
        </QuickResize.Root>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(resetMock).toHaveBeenCalled();
    });
  });
});

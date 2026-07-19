/**
 * QuickWatermark 原语(Layer 1)单测。
 *
 * 测试覆盖:
 *   - 不在 Root 内使用时抛错
 *   - Root 渲染 children
 *   - Upload 渲染 + ARIA + 拖拽
 *   - PresetSwitcher 渲染 3 个按钮 + radiogroup
 *   - Preview 渲染图片或占位
 *   - TextInput 渲染 + 受控 + busy 时禁用
 *   - DownloadButton 渲染(有/无输出)
 *   - ErrorDisplay 渲染(有/无错误)
 *   - ResetButton 渲染 + 禁用态
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';
import { QuickWatermark } from '../primitives/QuickWatermark';

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

describe('QuickWatermark 原语', () => {
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
        <QuickWatermark.Root>
          <div>hello</div>
        </QuickWatermark.Root>
      );
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });

  describe('Upload', () => {
    it('不在 Root 内使用时抛错', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<QuickWatermark.Upload />)).toThrow(
        /必须包裹在 <QuickWatermark.Root> 内/
      );
      spy.mockRestore();
    });

    it('渲染 role=button + aria-label', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.Upload aria-label="Pick image" />
        </QuickWatermark.Root>
      );
      const btn = screen.getByRole('button', { name: 'Pick image' });
      expect(btn).toBeInTheDocument();
    });

    it('busy 时 aria-disabled=true', () => {
      setMockState({ busy: true });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.Upload />
        </QuickWatermark.Root>
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-disabled', 'true');
    });

    it('函数 children 接收 isDragging 状态', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.Upload>{({ isDragging }) => <span>{isDragging ? 'dragging' : 'idle'}</span>}</QuickWatermark.Upload>
        </QuickWatermark.Root>
      );
      expect(screen.getByText('idle')).toBeInTheDocument();
    });
  });

  describe('PresetSwitcher', () => {
    it('渲染 3 个 radio 按钮(默认预设顺序)', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.PresetSwitcher />
        </QuickWatermark.Root>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });

    it('外层为 radiogroup', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.PresetSwitcher />
        </QuickWatermark.Root>
      );
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('当前 preset 对应的 radio aria-checked=true', () => {
      render(
        <QuickWatermark.Root initialPreset="tile">
          <QuickWatermark.PresetSwitcher />
        </QuickWatermark.Root>
      );
      const radios = screen.getAllByRole('radio');
      const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
      expect(checked).toHaveLength(1);
    });
  });

  describe('Preview', () => {
    it('无图片时渲染 placeholder', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.Preview type="input" placeholder="empty" />
        </QuickWatermark.Root>
      );
      expect(screen.getByText('empty')).toBeInTheDocument();
    });

    it('有图片时渲染 <img>', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.Preview type="input" />
        </QuickWatermark.Root>
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
        <QuickWatermark.Root>
          <QuickWatermark.Preview type="input" />
        </QuickWatermark.Root>
      );
      expect(screen.getByText(/PNG/)).toBeInTheDocument();
    });
  });

  describe('TextInput', () => {
    it('默认渲染 textbox,值为 DEFAULT_WATERMARK_TEXT', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.TextInput />
        </QuickWatermark.Root>
      );
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('Lokvis');
    });

    it('aria-label 默认为 "Watermark text"', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.TextInput />
        </QuickWatermark.Root>
      );
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Watermark text');
    });

    it('placeholder 可自定义', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.TextInput placeholder="输入水印文字" />
        </QuickWatermark.Root>
      );
      const input = screen.getByPlaceholderText('输入水印文字');
      expect(input).toBeInTheDocument();
    });

    it('initialText 反映在 input value 上', () => {
      render(
        <QuickWatermark.Root initialText="CustomMark">
          <QuickWatermark.TextInput />
        </QuickWatermark.Root>
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('CustomMark');
    });

    it('busy 时禁用', () => {
      setMockState({ busy: true });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.TextInput />
        </QuickWatermark.Root>
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input).toBeDisabled();
    });

    it('输入触发 setText(已有输入会重跑 workflow)', async () => {
      setMockState({ inputId: 'input-1', ready: true });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.TextInput />
        </QuickWatermark.Root>
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'NewText' } });
      // setText 触发 runWorkflow(inputId 存在,busy=false)
      // 等 useEffect 触发(autoRun 也可能触发)
      await Promise.resolve();
      // 验证 setText 更新了 value
      expect(input.value).toBe('NewText');
    });

    it('maxLength 可自定义(默认 50)', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.TextInput maxLength={20} />
        </QuickWatermark.Root>
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.maxLength).toBe(20);
    });
  });

  describe('DownloadButton', () => {
    it('无输出时不渲染', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.DownloadButton />
        </QuickWatermark.Root>
      );
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('有输出时渲染 button', () => {
      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.DownloadButton>下载</QuickWatermark.DownloadButton>
        </QuickWatermark.Root>
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
        <QuickWatermark.Root>
          <QuickWatermark.DownloadButton>下载</QuickWatermark.DownloadButton>
        </QuickWatermark.Root>
      );
      fireEvent.click(screen.getByRole('button', { name: '下载' }));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('默认 fileName=watermarked,扩展名按 blob.type 推断', () => {
      const createObjectURL = vi.fn(() => 'blob:mock');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(globalThis, 'URL', {
        value: { ...URL, createObjectURL, revokeObjectURL },
        writable: true,
      });
      const anchorSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('watermarked.webp');
      });

      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.DownloadButton />
        </QuickWatermark.Root>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(anchorSpy).toHaveBeenCalled();
      anchorSpy.mockRestore();
    });
  });

  describe('ErrorDisplay', () => {
    it('无错误时不渲染', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ErrorDisplay />
        </QuickWatermark.Root>
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('有 error 时渲染 role=alert', () => {
      setMockState({ error: 'something went wrong' });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ErrorDisplay />
        </QuickWatermark.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('something went wrong');
    });

    it('有 initError 时也渲染', () => {
      setMockState({ initError: 'runtime init failed' });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ErrorDisplay />
        </QuickWatermark.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('runtime init failed');
    });

    it('自定义 format 函数', () => {
      setMockState({ error: 'oops' });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ErrorDisplay format={(e) => `Error: ${e}`} />
        </QuickWatermark.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Error: oops');
    });
  });

  describe('ResetButton', () => {
    it('无输入且 disabledWhenEmpty=true 时禁用', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ResetButton />
        </QuickWatermark.Root>
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('有输入时启用', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ResetButton />
        </QuickWatermark.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('disabledWhenEmpty=false 时始终启用', () => {
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ResetButton disabledWhenEmpty={false} />
        </QuickWatermark.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('点击调用 reset', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <QuickWatermark.Root>
          <QuickWatermark.ResetButton />
        </QuickWatermark.Root>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(resetMock).toHaveBeenCalled();
    });
  });
});

/**
 * ImageConvert 原语(Layer 1)单测。
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
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import { ImageConvert } from '../primitives/ImageConvert';
import { detectEncodeSupport } from '../internal/format-support';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

// jsdom 不实现 canvas.toBlob,真实 detectEncodeSupport 会挂起并泄漏控制台错误。
// mock 为"全部格式支持",与测试"浏览器能力齐全"的假设一致。
vi.mock('../internal/format-support', () => ({
  detectEncodeSupport: vi.fn(async (formats: readonly string[]) => {
    const support: Record<string, boolean> = {};
    for (const fmt of formats) {
      support[fmt] = true;
    }
    return support;
  }),
}));

// wasm 兜底开关 mock:默认关闭,保持"纯原生门控"用例语义(avif 原生不支持即禁用)。
// 注:useImageConvert 通过 @lokvis/plugin-image(Capability 桥接)访问。
const wasmEncodersEnabledMock = vi.fn(() => false);
vi.mock('@lokvis/plugin-image', () => ({
  wasmEncodersEnabled: () => wasmEncodersEnabledMock(),
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
    commitOutput: vi.fn(),
    ...overrides,
  };
}

function resetMocks() {
  runWorkflowMock.mockReset();
  runWorkflowRawMock.mockReset();
  handleFilesMock.mockReset();
  resetMock.mockReset();
  clearErrorMock.mockReset();
  wasmEncodersEnabledMock.mockReset();
  wasmEncodersEnabledMock.mockReturnValue(false);
}

describe('ImageConvert 原语', () => {
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
        <ImageConvert.Root>
          <div>hello</div>
        </ImageConvert.Root>
      );
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });

  describe('Upload', () => {
    it('不在 Root 内使用时抛错', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<ImageConvert.Upload />)).toThrow(
        /必须包裹在 <ImageConvert.Root> 内/
      );
      spy.mockRestore();
    });

    it('渲染 role=button + aria-label', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.Upload aria-label="Pick image" />
        </ImageConvert.Root>
      );
      const btn = screen.getByRole('button', { name: 'Pick image' });
      expect(btn).toBeInTheDocument();
    });

    it('busy 时 aria-disabled=true', () => {
      setMockState({ busy: true });
      render(
        <ImageConvert.Root>
          <ImageConvert.Upload />
        </ImageConvert.Root>
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-disabled', 'true');
    });

    it('函数 children 接收 isDragging 状态', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.Upload>{({ isDragging }) => <span>{isDragging ? 'dragging' : 'idle'}</span>}</ImageConvert.Upload>
        </ImageConvert.Root>
      );
      expect(screen.getByText('idle')).toBeInTheDocument();
    });
  });

  describe('PresetSwitcher', () => {
    it('渲染 4 个 radio 按钮(默认预设顺序)', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.PresetSwitcher />
        </ImageConvert.Root>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);
    });

    it('外层为 radiogroup', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.PresetSwitcher />
        </ImageConvert.Root>
      );
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('当前 preset 对应的 radio aria-checked=true', () => {
      render(
        <ImageConvert.Root initialPreset="avif">
          <ImageConvert.PresetSwitcher />
        </ImageConvert.Root>
      );
      const radios = screen.getAllByRole('radio');
      const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
      expect(checked).toHaveLength(1);
    });

    it('浏览器不支持的预设(如 avif)渲染为禁用态', async () => {
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      await act(async () => {
        render(
          <ImageConvert.Root>
            <ImageConvert.PresetSwitcher />
          </ImageConvert.Root>
        );
      });
      expect(screen.getByRole('radio', { name: 'avif' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'webp' })).toBeEnabled();
    });

    it('wasm 兜底启用时,原生不支持的 avif 预设渲染为可用态', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      await act(async () => {
        render(
          <ImageConvert.Root>
            <ImageConvert.PresetSwitcher />
          </ImageConvert.Root>
        );
      });
      expect(screen.getByRole('radio', { name: 'avif' })).toBeEnabled();
    });
  });

  describe('Preview', () => {
    it('无图片时渲染 placeholder', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.Preview type="input" placeholder="empty" />
        </ImageConvert.Root>
      );
      expect(screen.getByText('empty')).toBeInTheDocument();
    });

    it('有图片时渲染 <img>', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <ImageConvert.Root>
          <ImageConvert.Preview type="input" />
        </ImageConvert.Root>
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
        <ImageConvert.Root>
          <ImageConvert.Preview type="input" />
        </ImageConvert.Root>
      );
      expect(screen.getByText(/PNG/)).toBeInTheDocument();
    });
  });

  describe('FormatBadge', () => {
    it('无输出时不渲染', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.FormatBadge />
        </ImageConvert.Root>
      );
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('有 input + output 时渲染 role=status', () => {
      setMockState({
        inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
        outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
      });
      render(
        <ImageConvert.Root>
          <ImageConvert.FormatBadge />
        </ImageConvert.Root>
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
        <ImageConvert.Root>
          <ImageConvert.FormatBadge format={(i, o) => `from ${i} to ${o}`} />
        </ImageConvert.Root>
      );
      expect(screen.getByRole('status')).toHaveTextContent('from PNG to WEBP');
    });
  });

  describe('DownloadButton', () => {
    it('无输出时不渲染', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.DownloadButton />
        </ImageConvert.Root>
      );
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('有输出时渲染 button', () => {
      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <ImageConvert.Root>
          <ImageConvert.DownloadButton>下载</ImageConvert.DownloadButton>
        </ImageConvert.Root>
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
        <ImageConvert.Root>
          <ImageConvert.DownloadButton>下载</ImageConvert.DownloadButton>
        </ImageConvert.Root>
      );
      fireEvent.click(screen.getByRole('button', { name: '下载' }));
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('ErrorDisplay', () => {
    it('无错误时不渲染', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.ErrorDisplay />
        </ImageConvert.Root>
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('有 error 时渲染 role=alert', () => {
      setMockState({ error: 'something went wrong' });
      render(
        <ImageConvert.Root>
          <ImageConvert.ErrorDisplay />
        </ImageConvert.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('something went wrong');
    });

    it('有 initError 时也渲染', () => {
      setMockState({ initError: 'runtime init failed' });
      render(
        <ImageConvert.Root>
          <ImageConvert.ErrorDisplay />
        </ImageConvert.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('runtime init failed');
    });
  });

  describe('ResetButton', () => {
    it('无输入且 disabledWhenEmpty=true 时禁用', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.ResetButton />
        </ImageConvert.Root>
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('有输入时启用', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <ImageConvert.Root>
          <ImageConvert.ResetButton />
        </ImageConvert.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('disabledWhenEmpty=false 时始终启用', () => {
      render(
        <ImageConvert.Root>
          <ImageConvert.ResetButton disabledWhenEmpty={false} />
        </ImageConvert.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('点击调用 reset', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <ImageConvert.Root>
          <ImageConvert.ResetButton />
        </ImageConvert.Root>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(resetMock).toHaveBeenCalled();
    });
  });
});

/**
 * ImageCrop 原语(Layer 1)单测。
 *
 * 测试覆盖:
 *   - 不在 Root 内使用时抛错
 *   - Root 渲染 children
 *   - Upload 渲染 + ARIA + 拖拽
 *   - PresetSwitcher 渲染 4 个按钮 + radiogroup
 *   - Preview 渲染图片或占位
 *   - CropArea 渲染(无图片 / 有图片 + 裁剪框叠加层)
 *   - DownloadButton 渲染(有/无输出)
 *   - ErrorDisplay 渲染(有/无错误)
 *   - ResetButton 渲染 + 禁用态
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import { ImageCrop } from '../primitives/ImageCrop';

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
}

describe('ImageCrop 原语', () => {
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
        <ImageCrop.Root>
          <div>hello</div>
        </ImageCrop.Root>
      );
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });

  describe('Upload', () => {
    it('不在 Root 内使用时抛错', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<ImageCrop.Upload />)).toThrow(
        /必须包裹在 <ImageCrop.Root> 内/
      );
      spy.mockRestore();
    });

    it('渲染 role=button + aria-label', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.Upload aria-label="Pick image" />
        </ImageCrop.Root>
      );
      const btn = screen.getByRole('button', { name: 'Pick image' });
      expect(btn).toBeInTheDocument();
    });

    it('busy 时 aria-disabled=true', () => {
      setMockState({ busy: true });
      render(
        <ImageCrop.Root>
          <ImageCrop.Upload />
        </ImageCrop.Root>
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveAttribute('aria-disabled', 'true');
    });

    it('函数 children 接收 isDragging 状态', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.Upload>{({ isDragging }) => <span>{isDragging ? 'dragging' : 'idle'}</span>}</ImageCrop.Upload>
        </ImageCrop.Root>
      );
      expect(screen.getByText('idle')).toBeInTheDocument();
    });
  });

  describe('PresetSwitcher', () => {
    it('渲染 4 个 radio 按钮(默认预设顺序)', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.PresetSwitcher />
        </ImageCrop.Root>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);
    });

    it('外层为 radiogroup', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.PresetSwitcher />
        </ImageCrop.Root>
      );
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('当前 preset 对应的 radio aria-checked=true', () => {
      render(
        <ImageCrop.Root initialPreset="16:9">
          <ImageCrop.PresetSwitcher />
        </ImageCrop.Root>
      );
      const radios = screen.getAllByRole('radio');
      const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
      expect(checked).toHaveLength(1);
    });
  });

  describe('Preview', () => {
    it('无图片时渲染 placeholder', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.Preview type="input" placeholder="empty" />
        </ImageCrop.Root>
      );
      expect(screen.getByText('empty')).toBeInTheDocument();
    });

    it('有图片时渲染 <img>', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <ImageCrop.Root>
          <ImageCrop.Preview type="input" />
        </ImageCrop.Root>
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
        <ImageCrop.Root>
          <ImageCrop.Preview type="input" />
        </ImageCrop.Root>
      );
      expect(screen.getByText(/PNG/)).toBeInTheDocument();
    });
  });

  describe('CropArea', () => {
    it('无输入图片时渲染 placeholder', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.CropArea placeholder="no input" />
        </ImageCrop.Root>
      );
      expect(screen.getByText('no input')).toBeInTheDocument();
    });

    it('有输入图片时渲染 role=img + img 元素', () => {
      setMockState({
        inputUrl: 'blob:input',
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      render(
        <ImageCrop.Root>
          <ImageCrop.CropArea />
        </ImageCrop.Root>
      );
      // CropArea 容器本身有 role=img(还有内部 <img>)
      const imgs = screen.getAllByRole('img');
      expect(imgs.length).toBeGreaterThanOrEqual(1);
    });

    it('square 预设时渲染裁剪框叠加层(aria-label 包含尺寸)', () => {
      setMockState({
        inputUrl: 'blob:input',
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      render(
        <ImageCrop.Root initialPreset="square">
          <ImageCrop.CropArea />
        </ImageCrop.Root>
      );
      // 裁剪框有 aria-label "Crop region: ..."
      const cropLabel = screen.getByLabelText(/Crop region: 600×600/);
      expect(cropLabel).toBeInTheDocument();
    });

    it('free 预设时裁剪框尺寸 = 整图', () => {
      setMockState({
        inputUrl: 'blob:input',
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      render(
        <ImageCrop.Root initialPreset="free">
          <ImageCrop.CropArea />
        </ImageCrop.Root>
      );
      const cropLabel = screen.getByLabelText(/Crop region: 800×600/);
      expect(cropLabel).toBeInTheDocument();
    });

    it('自定义 aria-label 应用到容器', () => {
      setMockState({
        inputUrl: 'blob:input',
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      render(
        <ImageCrop.Root>
          <ImageCrop.CropArea aria-label="My crop area" />
        </ImageCrop.Root>
      );
      // 容器 role=img + aria-label="My crop area"
      const container = screen.getByRole('img', { name: 'My crop area' });
      expect(container).toBeInTheDocument();
    });
  });

  describe('DownloadButton', () => {
    it('无输出时不渲染', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.DownloadButton />
        </ImageCrop.Root>
      );
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('有输出时渲染 button', () => {
      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <ImageCrop.Root>
          <ImageCrop.DownloadButton>下载</ImageCrop.DownloadButton>
        </ImageCrop.Root>
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
        <ImageCrop.Root>
          <ImageCrop.DownloadButton>下载</ImageCrop.DownloadButton>
        </ImageCrop.Root>
      );
      fireEvent.click(screen.getByRole('button', { name: '下载' }));
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('ErrorDisplay', () => {
    it('无错误时不渲染', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.ErrorDisplay />
        </ImageCrop.Root>
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('有 error 时渲染 role=alert', () => {
      setMockState({ error: 'something went wrong' });
      render(
        <ImageCrop.Root>
          <ImageCrop.ErrorDisplay />
        </ImageCrop.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('something went wrong');
    });

    it('有 initError 时也渲染', () => {
      setMockState({ initError: 'runtime init failed' });
      render(
        <ImageCrop.Root>
          <ImageCrop.ErrorDisplay />
        </ImageCrop.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('runtime init failed');
    });

    it('自定义 format 函数', () => {
      setMockState({ error: 'oops' });
      render(
        <ImageCrop.Root>
          <ImageCrop.ErrorDisplay format={(e) => `Error: ${e}`} />
        </ImageCrop.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Error: oops');
    });
  });

  describe('ResetButton', () => {
    it('无输入且 disabledWhenEmpty=true 时禁用', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.ResetButton />
        </ImageCrop.Root>
      );
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('有输入时启用', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <ImageCrop.Root>
          <ImageCrop.ResetButton />
        </ImageCrop.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('disabledWhenEmpty=false 时始终启用', () => {
      render(
        <ImageCrop.Root>
          <ImageCrop.ResetButton disabledWhenEmpty={false} />
        </ImageCrop.Root>
      );
      expect(screen.getByRole('button')).toBeEnabled();
    });

    it('点击调用 reset', () => {
      setMockState({ inputUrl: 'blob:input' });
      render(
        <ImageCrop.Root>
          <ImageCrop.ResetButton />
        </ImageCrop.Root>
      );
      fireEvent.click(screen.getByRole('button'));
      expect(resetMock).toHaveBeenCalled();
    });
  });
});

/**
 * ImageCompress 原语(Layer 1)单测。
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
import type { UseImageToolResult } from '../internal/useImageTool';
import { downloadBlob } from '@lokvis/embed-kit';
import { ImageCompress } from '../primitives/ImageCompress';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

// downloadBlob spy 化:保留 @lokvis/embed-kit 其他真实实现,仅替换下载动作
// (jsdom 无 URL.createObjectURL,且测试只关心文件名)
vi.mock('@lokvis/embed-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lokvis/embed-kit')>();
  return { ...actual, downloadBlob: vi.fn() };
});

const downloadBlobMock = vi.mocked(downloadBlob);

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
  downloadBlobMock.mockReset();
}

// ─── 测试 ───────────────────────────────────────────────────

describe('ImageCompress 原语', () => {
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
        <ImageCompress.Root>
          <div>hello</div>
        </ImageCompress.Root>
      );
      expect(screen.getByText('hello')).toBeInTheDocument();
    });
  });

  describe('Upload', () => {
    it('不在 Root 内使用时抛错', () => {
      // 抑制 console.error(React 会在抛错前调用)
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<ImageCompress.Upload />)).toThrow(/ImageCompress primitives/);
      spy.mockRestore();
    });

    it('渲染默认 children', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.Upload>点击上传</ImageCompress.Upload>
        </ImageCompress.Root>
      );
      expect(screen.getByText('点击上传')).toBeInTheDocument();
    });

    it('具有 button role 与 ARIA label', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.Upload aria-label="上传图片">上传</ImageCompress.Upload>
        </ImageCompress.Root>
      );
      const btn = screen.getByRole('button', { name: '上传图片' });
      expect(btn).toBeInTheDocument();
    });

    it('点击触发 file input', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.Upload>点击</ImageCompress.Upload>
        </ImageCompress.Root>
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
        <ImageCompress.Root>
          <ImageCompress.Upload>上传</ImageCompress.Upload>
        </ImageCompress.Root>
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
        <ImageCompress.Root>
          <ImageCompress.PresetSwitcher />
        </ImageCompress.Root>
      );
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(screen.getByText('balanced')).toBeInTheDocument();
      expect(screen.getByText('highQuality')).toBeInTheDocument();
      expect(screen.getByText('small')).toBeInTheDocument();
    });

    it('默认 balanced 为选中态(aria-checked=true)', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.PresetSwitcher />
        </ImageCompress.Root>
      );
      const balanced = screen.getByText('balanced').closest('button')!;
      expect(balanced).toHaveAttribute('aria-checked', 'true');
    });

    it('点击 highQuality 切换选中态', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.PresetSwitcher />
        </ImageCompress.Root>
      );
      fireEvent.click(screen.getByText('highQuality'));
      const highQ = screen.getByText('highQuality').closest('button')!;
      expect(highQ).toHaveAttribute('aria-checked', 'true');
    });

    it('支持自定义 renderButton', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.PresetSwitcher
            renderButton={(preset, isSelected) => (
              <span data-testid={`preset-${preset}`} data-selected={isSelected}>
                {preset}
              </span>
            )}
          />
        </ImageCompress.Root>
      );
      expect(screen.getByTestId('preset-balanced')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('preset-small')).toHaveAttribute('data-selected', 'false');
    });
  });

  describe('Preview', () => {
    it('无 url 时渲染占位', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.Preview type="output" placeholder="无图片" />
        </ImageCompress.Root>
      );
      expect(screen.getByText('无图片')).toBeInTheDocument();
    });

    it('有 url 时渲染 <img>', () => {
      setMockState({ outputUrl: 'blob:output-1' });
      render(
        <ImageCompress.Root>
          <ImageCompress.Preview type="output" alt="输出图片" />
        </ImageCompress.Root>
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
        <ImageCompress.Root>
          <ImageCompress.Preview type="input" />
        </ImageCompress.Root>
      );
      expect(screen.getByText(/800×600/)).toBeInTheDocument();
    });
  });

  describe('RatioBadge', () => {
    it('无输出时不渲染', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.RatioBadge />
        </ImageCompress.Root>
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
        <ImageCompress.Root>
          <ImageCompress.RatioBadge />
        </ImageCompress.Root>
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
        <ImageCompress.Root>
          <ImageCompress.RatioBadge format={(r) => `压缩率:${r.toFixed(1)}%`} />
        </ImageCompress.Root>
      );
      expect(screen.getByRole('status')).toHaveTextContent('压缩率:70.0%');
    });
  });

  describe('DownloadButton', () => {
    it('无 outputBlob 时不渲染', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.DownloadButton>下载</ImageCompress.DownloadButton>
        </ImageCompress.Root>
      );
      expect(screen.queryByText('下载')).toBeNull();
    });

    it('有 outputBlob 时渲染按钮', () => {
      setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
      render(
        <ImageCompress.Root>
          <ImageCompress.DownloadButton>下载</ImageCompress.DownloadButton>
        </ImageCompress.Root>
      );
      expect(screen.getByText('下载')).toBeInTheDocument();
    });

    it('默认扩展名按 outputBlob.type 推断(image/png → .png)', () => {
      const blob = new Blob(['x'], { type: 'image/png' });
      setMockState({ outputBlob: blob });
      render(
        <ImageCompress.Root>
          <ImageCompress.DownloadButton>下载</ImageCompress.DownloadButton>
        </ImageCompress.Root>
      );
      fireEvent.click(screen.getByText('下载'));
      expect(downloadBlobMock).toHaveBeenCalledWith(blob, 'compressed.png');
    });

    it('默认扩展名推断覆盖常见格式(jpeg/avif/ico)', () => {
      const cases: Array<[string, string]> = [
        ['image/jpeg', 'compressed.jpg'],
        ['image/avif', 'compressed.avif'],
        ['image/x-icon', 'compressed.ico'],
      ];
      for (const [mime, expected] of cases) {
        const blob = new Blob(['x'], { type: mime });
        setMockState({ outputBlob: blob });
        const { unmount } = render(
          <ImageCompress.Root>
            <ImageCompress.DownloadButton>下载</ImageCompress.DownloadButton>
          </ImageCompress.Root>
        );
        fireEvent.click(screen.getByText('下载'));
        expect(downloadBlobMock).toHaveBeenLastCalledWith(blob, expected);
        unmount();
      }
    });

    it('未知 MIME 类型回退 .img', () => {
      const blob = new Blob(['x'], { type: 'image/bmp' });
      setMockState({ outputBlob: blob });
      render(
        <ImageCompress.Root>
          <ImageCompress.DownloadButton>下载</ImageCompress.DownloadButton>
        </ImageCompress.Root>
      );
      fireEvent.click(screen.getByText('下载'));
      expect(downloadBlobMock).toHaveBeenCalledWith(blob, 'compressed.img');
    });

    it('显式 extension prop 优先于类型推断', () => {
      const blob = new Blob(['x'], { type: 'image/png' });
      setMockState({ outputBlob: blob });
      render(
        <ImageCompress.Root>
          <ImageCompress.DownloadButton extension="webp">下载</ImageCompress.DownloadButton>
        </ImageCompress.Root>
      );
      fireEvent.click(screen.getByText('下载'));
      expect(downloadBlobMock).toHaveBeenCalledWith(blob, 'compressed.webp');
    });

    it('fileName prop 与推断扩展名组合', () => {
      const blob = new Blob(['x'], { type: 'image/webp' });
      setMockState({ outputBlob: blob });
      render(
        <ImageCompress.Root>
          <ImageCompress.DownloadButton fileName="photo">下载</ImageCompress.DownloadButton>
        </ImageCompress.Root>
      );
      fireEvent.click(screen.getByText('下载'));
      expect(downloadBlobMock).toHaveBeenCalledWith(blob, 'photo.webp');
    });
  });

  describe('ErrorDisplay', () => {
    it('无错误时不渲染', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.ErrorDisplay />
        </ImageCompress.Root>
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('有 error 时渲染(alert role)', () => {
      setMockState({ error: 'compress failed' });
      render(
        <ImageCompress.Root>
          <ImageCompress.ErrorDisplay />
        </ImageCompress.Root>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('compress failed');
    });

    it('initError 也会显示', () => {
      setMockState({ initError: 'runtime init failed' });
      render(
        <ImageCompress.Root>
          <ImageCompress.ErrorDisplay />
        </ImageCompress.Root>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('runtime init failed');
    });
  });

  describe('ResetButton', () => {
    it('无输入时禁用(disabledWhenEmpty=true 默认)', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.ResetButton>重置</ImageCompress.ResetButton>
        </ImageCompress.Root>
      );
      expect(screen.getByText('重置')).toBeDisabled();
    });

    it('有输入时启用,点击触发 reset', () => {
      setMockState({ inputUrl: 'blob:input-1' });
      render(
        <ImageCompress.Root>
          <ImageCompress.ResetButton>重置</ImageCompress.ResetButton>
        </ImageCompress.Root>
      );
      const btn = screen.getByText('重置');
      expect(btn).not.toBeDisabled();
      fireEvent.click(btn);
      expect(resetMock).toHaveBeenCalledTimes(1);
    });

    it('disabledWhenEmpty=false 时无输入也可点击', () => {
      render(
        <ImageCompress.Root>
          <ImageCompress.ResetButton disabledWhenEmpty={false}>重置</ImageCompress.ResetButton>
        </ImageCompress.Root>
      );
      expect(screen.getByText('重置')).not.toBeDisabled();
    });
  });
});

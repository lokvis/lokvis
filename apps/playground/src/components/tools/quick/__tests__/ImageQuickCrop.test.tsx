/**
 * ImageQuickCrop 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';
import ImageQuickCrop from '../ImageQuickCrop';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('@/components/toolkit/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

vi.mock('@/i18n/useLang', () => ({
  useLang: () => 'en',
}));

vi.mock('@/i18n/utils', () => ({
  useTranslations: () => (key: string) => key,
  t: (_lang: string, key: string) => key,
  getLangFromUrl: () => 'en',
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

describe('ImageQuickCrop 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-crop class', () => {
    const { container } = render(<ImageQuickCrop />);
    const root = container.querySelector('.lokvis-quick-crop');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<ImageQuickCrop />);
    expect(screen.getByText('quickCrop.title')).toBeInTheDocument();
    expect(screen.getByText('quickCrop.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 4 个预设按钮(radio)', () => {
    render(<ImageQuickCrop />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('默认渲染 UploadBox(role=button)', () => {
    render(<ImageQuickCrop />);
    const uploadBtn = screen.getByRole('button', { name: 'Upload image' });
    expect(uploadBtn).toBeInTheDocument();
  });

  it('默认渲染 CropArea(显示 cropArea 标签)', () => {
    render(<ImageQuickCrop />);
    expect(screen.getByText('quickCrop.cropArea')).toBeInTheDocument();
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<ImageQuickCrop showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showCropArea=false 隐藏裁剪区域', () => {
    render(<ImageQuickCrop showCropArea={false} />);
    expect(screen.queryByText('quickCrop.cropArea')).toBeNull();
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(CropArea 还显示 1 个 "No image")', () => {
    render(<ImageQuickCrop showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    // CropArea 占位 + 1 个 PreviewBox(output)
    expect(placeholders).toHaveLength(2);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview + 1 个 CropArea', () => {
    render(<ImageQuickCrop showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    // CropArea 占位 + 2 个 PreviewBox(input + output)
    expect(placeholders).toHaveLength(3);
  });

  it('showCropArea=false + showBeforeAfter=false 时只渲染 1 个 preview', () => {
    render(<ImageQuickCrop showCropArea={false} showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showCropArea=false + showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<ImageQuickCrop showCropArea={false} showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<ImageQuickCrop showDownloadButton={false} />);
    expect(screen.queryByText('quickCrop.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<ImageQuickCrop showResetButton={false} />);
    expect(screen.queryByText('quickCrop.retry')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <ImageQuickCrop theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-crop') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<ImageQuickCrop className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-crop');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(
      <ImageQuickCrop style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-crop') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<ImageQuickCrop components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 CropAreaBox', () => {
    const CustomCropArea = () => <div data-testid="custom-crop">custom crop</div>;
    render(<ImageQuickCrop components={{ CropAreaBox: CustomCropArea }} />);
    expect(screen.getByTestId('custom-crop')).toBeInTheDocument();
    // CropAreaBox 替换后,不再渲染默认 CropArea(quickCrop.cropArea 标签仍存在)
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<ImageQuickCrop components={{ DownloadButton: CustomDownload }} />);
    expect(screen.getByTestId('custom-download')).toBeInTheDocument();
  });

  it('components prop 替换所有子组件', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Replace: React.ComponentType<any> = ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="replaced">{children ?? 'replaced'}</div>
    );
    render(
      <ImageQuickCrop
        components={{
          UploadBox: Replace,
          PreviewBox: () => <div data-testid="replaced" />,
          PresetSwitcher: Replace,
          CropAreaBox: Replace,
          DownloadButton: Replace,
          ErrorDisplay: Replace,
          ResetButton: Replace,
        }}
      />
    );
    expect(screen.getAllByTestId('replaced').length).toBeGreaterThanOrEqual(7);
  });
});

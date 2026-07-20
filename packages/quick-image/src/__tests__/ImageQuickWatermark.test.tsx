/**
 * ImageQuickWatermark 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import ImageQuickWatermark from '../ImageQuickWatermark';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

vi.mock('../i18n/useLang', () => ({
  useLang: () => 'en',
}));

vi.mock('../i18n/utils', () => ({
  useTranslations: () => (key: string) => key,
  t: (_lang: string, key: string) => key,
  getLangFromUrl: () => 'en',
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

describe('ImageQuickWatermark 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-watermark class', () => {
    const { container } = render(<ImageQuickWatermark />);
    const root = container.querySelector('.lokvis-quick-watermark');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<ImageQuickWatermark />);
    expect(screen.getByText('quickWatermark.title')).toBeInTheDocument();
    expect(screen.getByText('quickWatermark.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 3 个预设按钮(radio)', () => {
    render(<ImageQuickWatermark />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('默认渲染 UploadBox(role=button)', () => {
    render(<ImageQuickWatermark />);
    const uploadBtn = screen.getByRole('button', { name: 'Upload image' });
    expect(uploadBtn).toBeInTheDocument();
  });

  it('默认渲染 TextInput(role=textbox,值=Lokvis)', () => {
    render(<ImageQuickWatermark />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Lokvis');
  });

  it('initialText 反映到 TextInput 值', () => {
    render(<ImageQuickWatermark initialText="Hello" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Hello');
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<ImageQuickWatermark showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showTextInput=false 隐藏文字输入框', () => {
    render(<ImageQuickWatermark showTextInput={false} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无图片)', () => {
    render(<ImageQuickWatermark showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<ImageQuickWatermark showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<ImageQuickWatermark showDownloadButton={false} />);
    expect(screen.queryByText('quickWatermark.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<ImageQuickWatermark showResetButton={false} />);
    expect(screen.queryByText('quickWatermark.retry')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <ImageQuickWatermark theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-watermark') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<ImageQuickWatermark className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-watermark');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(
      <ImageQuickWatermark style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-watermark') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<ImageQuickWatermark components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 TextInput', () => {
    const CustomTextInput = () => <div data-testid="custom-text">custom text</div>;
    render(<ImageQuickWatermark components={{ TextInput: CustomTextInput }} />);
    expect(screen.getByTestId('custom-text')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<ImageQuickWatermark components={{ DownloadButton: CustomDownload }} />);
    expect(screen.getByTestId('custom-download')).toBeInTheDocument();
  });

  it('components prop 替换所有子组件', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Replace: React.ComponentType<any> = ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="replaced">{children ?? 'replaced'}</div>
    );
    render(
      <ImageQuickWatermark
        components={{
          UploadBox: Replace,
          PreviewBox: () => <div data-testid="replaced" />,
          PresetSwitcher: Replace,
          TextInput: Replace,
          DownloadButton: Replace,
          ErrorDisplay: Replace,
          ResetButton: Replace,
        }}
      />
    );
    expect(screen.getAllByTestId('replaced').length).toBeGreaterThanOrEqual(7);
  });
});

/**
 * ImageQuickConvert 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import ImageQuickConvert from '../ImageQuickConvert';

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

describe('ImageQuickConvert 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-convert class', () => {
    const { container } = render(<ImageQuickConvert />);
    const root = container.querySelector('.lokvis-quick-convert');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<ImageQuickConvert />);
    expect(screen.getByText('quickConvert.title')).toBeInTheDocument();
    expect(screen.getByText('quickConvert.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 4 个预设按钮(radio)', () => {
    render(<ImageQuickConvert />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('默认渲染 UploadBox(role=button)', () => {
    render(<ImageQuickConvert />);
    const uploadBtn = screen.getByRole('button', { name: 'Upload image' });
    expect(uploadBtn).toBeInTheDocument();
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<ImageQuickConvert showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无图片)', () => {
    render(<ImageQuickConvert showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<ImageQuickConvert showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<ImageQuickConvert showDownloadButton={false} />);
    expect(screen.queryByText('quickConvert.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<ImageQuickConvert showResetButton={false} />);
    expect(screen.queryByText('quickConvert.retry')).toBeNull();
  });

  it('showFormat=false 时,即使有输出也不显示格式徽章', () => {
    setMockState({
      inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
      outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
    });
    render(<ImageQuickConvert showFormat={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <ImageQuickConvert theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-convert') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<ImageQuickConvert className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-convert');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(
      <ImageQuickConvert style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-convert') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<ImageQuickConvert components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<ImageQuickConvert components={{ DownloadButton: CustomDownload }} />);
    expect(screen.getByTestId('custom-download')).toBeInTheDocument();
  });

  it('components prop 替换所有子组件', () => {
    // 用精确类型替代 any:覆盖所有 slot 可能传入的 prop(children/type/className/style)。
    type ReplaceProps = {
      children?: React.ReactNode;
      type?: 'input' | 'output';
      className?: string;
      style?: React.CSSProperties;
    };
    const Replace: React.ComponentType<ReplaceProps> = ({ children }: ReplaceProps) => (
      <div data-testid="replaced">{children ?? 'replaced'}</div>
    );
    render(
      <ImageQuickConvert
        components={{
          UploadBox: Replace,
          PreviewBox: () => <div data-testid="replaced" />,
          PresetSwitcher: Replace,
          DownloadButton: Replace,
          FormatBadge: Replace,
          ErrorDisplay: Replace,
          ResetButton: Replace,
        }}
      />
    );
    expect(screen.getAllByTestId('replaced').length).toBeGreaterThanOrEqual(7);
  });
});

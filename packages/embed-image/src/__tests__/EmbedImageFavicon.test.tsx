/**
 * EmbedImageFavicon 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import EmbedImageFavicon from '../EmbedImageFavicon';

// jsdom 不实现 matchMedia,F1 的 useEmbedMode(mode='system') 需要它
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom 不提供 URL.createObjectURL / revokeObjectURL,favicon hook 自管 outputUrl 需要
(URL as { createObjectURL: (b: Blob) => string }).createObjectURL = () => 'blob:favicon';
(URL as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};

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
const exportAssetMock = vi.fn();

function setMockState(overrides: Partial<UseImageToolResult> = {}) {
  stateRef.current = {
    runtime: { exportAsset: exportAssetMock } as never,
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
  exportAssetMock.mockReset();
  runWorkflowRawMock.mockResolvedValue({ status: 'completed', outputs: ['out-1'] });
  exportAssetMock.mockResolvedValue(new Blob(['ico'], { type: 'image/x-icon' }));
}

describe('EmbedImageFavicon 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-favicon class', () => {
    const { container } = render(<EmbedImageFavicon />);
    const root = container.querySelector('.lokvis-quick-favicon');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<EmbedImageFavicon />);
    expect(screen.getByText('quickFavicon.title')).toBeInTheDocument();
    expect(screen.getByText('quickFavicon.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 3 个预设按钮(radio)', () => {
    render(<EmbedImageFavicon />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<EmbedImageFavicon showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无图片)', () => {
    render(<EmbedImageFavicon showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<EmbedImageFavicon showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('默认预设 full 渲染尺寸徽章(16/32/48/256)', () => {
    render(<EmbedImageFavicon />);
    expect(screen.getByText('16px · 32px · 48px · 256px')).toBeInTheDocument();
  });

  it('showSizes=false 隐藏尺寸徽章', () => {
    render(<EmbedImageFavicon showSizes={false} />);
    expect(screen.queryByText('16px · 32px · 48px · 256px')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <EmbedImageFavicon theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-favicon') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<EmbedImageFavicon className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-favicon');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(<EmbedImageFavicon style={{ margin: '20px' }} />);
    const root = container.querySelector('.lokvis-quick-favicon') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<EmbedImageFavicon components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换所有子组件', () => {
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
      <EmbedImageFavicon
        components={{
          UploadBox: Replace,
          PreviewBox: () => <div data-testid="replaced" />,
          PresetSwitcher: Replace,
          DownloadButton: Replace,
          SizeBadge: Replace,
          ErrorDisplay: Replace,
          ResetButton: Replace,
        }}
      />
    );
    expect(screen.getAllByTestId('replaced').length).toBeGreaterThanOrEqual(7);
  });

  it('F1: mode="dark" 时根元素 data-quick-mode="dark"', () => {
    const { container } = render(<EmbedImageFavicon mode="dark" />);
    const root = container.querySelector('.lokvis-quick-favicon') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('dark');
  });

  it('F1: mode="light" 时根元素 data-quick-mode="light"', () => {
    const { container } = render(<EmbedImageFavicon mode="light" />);
    const root = container.querySelector('.lokvis-quick-favicon') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('light');
  });

  it('F2: busy=true 时渲染 processing 文案 + aria-busy', () => {
    setMockState({ busy: true });
    const { container } = render(<EmbedImageFavicon />);
    expect(screen.getByText('quickFavicon.processing')).toBeInTheDocument();
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it('F3: inputInfo 不为 null 时渲染文件信息(format · WxH · size)', () => {
    setMockState({
      inputInfo: { width: 512, height: 512, size: 200000, format: 'PNG' },
    });
    render(<EmbedImageFavicon />);
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('512×512')).toBeInTheDocument();
  });

  it('F4: UploadBox 的 aria-label 使用 i18n dropHint 键', () => {
    render(<EmbedImageFavicon />);
    const uploadBtn = screen.getByRole('button', { name: 'quickFavicon.dropHint' });
    expect(uploadBtn).toBeInTheDocument();
  });

  it('autoRun 生成 ICO 后显示下载按钮(输出自管理)', async () => {
    setMockState({
      inputId: 'input-1',
      ready: true,
      inputInfo: { width: 512, height: 512, size: 200000, format: 'PNG' },
    });
    render(<EmbedImageFavicon />);
    await waitFor(() => {
      expect(screen.getByText('quickFavicon.download')).toBeInTheDocument();
    });
    const wf = runWorkflowRawMock.mock.calls[0]![0];
    expect(wf.nodes[0].capability).toBe('image.favicon');
  });
});

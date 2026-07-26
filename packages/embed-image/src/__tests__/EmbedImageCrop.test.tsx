/**
 * EmbedImageCrop 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import EmbedImageCrop from '../EmbedImageCrop';

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

describe('EmbedImageCrop 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-crop class', () => {
    const { container } = render(<EmbedImageCrop />);
    const root = container.querySelector('.lokvis-quick-crop');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<EmbedImageCrop />);
    expect(screen.getByText('quickCrop.title')).toBeInTheDocument();
    expect(screen.getByText('quickCrop.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 4 个预设按钮(radio)', () => {
    render(<EmbedImageCrop />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('默认渲染 CropArea(显示 cropArea 标签)', () => {
    render(<EmbedImageCrop />);
    expect(screen.getByText('quickCrop.cropArea')).toBeInTheDocument();
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<EmbedImageCrop showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showCropArea=false 隐藏裁剪区域', () => {
    render(<EmbedImageCrop showCropArea={false} />);
    expect(screen.queryByText('quickCrop.cropArea')).toBeNull();
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(CropArea 还显示 1 个 "No image")', () => {
    render(<EmbedImageCrop showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    // CropArea 占位 + 1 个 PreviewBox(output)
    expect(placeholders).toHaveLength(2);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview + 1 个 CropArea', () => {
    render(<EmbedImageCrop showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    // CropArea 占位 + 2 个 PreviewBox(input + output)
    expect(placeholders).toHaveLength(3);
  });

  it('showCropArea=false + showBeforeAfter=false 时只渲染 1 个 preview', () => {
    render(<EmbedImageCrop showCropArea={false} showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showCropArea=false + showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<EmbedImageCrop showCropArea={false} showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<EmbedImageCrop showDownloadButton={false} />);
    expect(screen.queryByText('quickCrop.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<EmbedImageCrop showResetButton={false} />);
    expect(screen.queryByText('quickCrop.retry')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <EmbedImageCrop theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-crop') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<EmbedImageCrop className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-crop');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(
      <EmbedImageCrop style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-crop') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<EmbedImageCrop components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 CropAreaBox', () => {
    const CustomCropArea = () => <div data-testid="custom-crop">custom crop</div>;
    render(<EmbedImageCrop components={{ CropAreaBox: CustomCropArea }} />);
    expect(screen.getByTestId('custom-crop')).toBeInTheDocument();
    // CropAreaBox 替换后,不再渲染默认 CropArea(quickCrop.cropArea 标签仍存在)
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<EmbedImageCrop components={{ DownloadButton: CustomDownload }} />);
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
      <EmbedImageCrop
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

  it('F1: mode="dark" 时根元素 data-quick-mode="dark"', () => {
    const { container } = render(<EmbedImageCrop mode="dark" />);
    const root = container.querySelector('.lokvis-quick-crop') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('dark');
  });

  it('F1: mode="light" 时根元素 data-quick-mode="light"', () => {
    const { container } = render(<EmbedImageCrop mode="light" />);
    const root = container.querySelector('.lokvis-quick-crop') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('light');
  });

  it('F2: busy=true 时渲染 processing 文案 + aria-busy', () => {
    setMockState({ busy: true });
    const { container } = render(<EmbedImageCrop />);
    // processing 文案(t mock 返回 key 字符串)
    expect(screen.getByText('quickCrop.processing')).toBeInTheDocument();
    // aria-busy
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it('F2: busy=false 时不渲染 processing 文案', () => {
    setMockState({ busy: false });
    render(<EmbedImageCrop />);
    expect(screen.queryByText('quickCrop.processing')).toBeNull();
  });

  it('F3: inputInfo 不为 null 时渲染文件信息(format · WxH · size)', () => {
    setMockState({
      inputInfo: { width: 1920, height: 1080, size: 2400000, format: 'PNG' },
    });
    render(<EmbedImageCrop />);
    // format badge(PNG 大写)
    expect(screen.getByText('PNG')).toBeInTheDocument();
    // 尺寸
    expect(screen.getByText('1920×1080')).toBeInTheDocument();
  });

  it('F3: inputInfo=null 时不渲染文件信息', () => {
    setMockState({ inputInfo: null });
    render(<EmbedImageCrop />);
    // 无 format badge(注意:placeholder "No image" 可能存在,但不应有 format)
    expect(screen.queryByText('PNG')).toBeNull();
  });

  it('F4: UploadBox 的 aria-label 使用 i18n dropHint 键', () => {
    render(<EmbedImageCrop />);
    // t mock 返回 key 字符串,所以 aria-label = 'quickCrop.dropHint'
    const uploadBtn = screen.getByRole('button', { name: 'quickCrop.dropHint' });
    expect(uploadBtn).toBeInTheDocument();
  });
});

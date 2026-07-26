/**
 * EmbedImageWatermark 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import EmbedImageWatermark from '../EmbedImageWatermark';

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

describe('EmbedImageWatermark 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-watermark class', () => {
    const { container } = render(<EmbedImageWatermark />);
    const root = container.querySelector('.lokvis-quick-watermark');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<EmbedImageWatermark />);
    expect(screen.getByText('quickWatermark.title')).toBeInTheDocument();
    expect(screen.getByText('quickWatermark.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 3 个预设按钮(radio)', () => {
    render(<EmbedImageWatermark />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('默认渲染 TextInput(role=textbox,值=Lokvis)', () => {
    render(<EmbedImageWatermark />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Lokvis');
  });

  it('initialText 反映到 TextInput 值', () => {
    render(<EmbedImageWatermark initialText="Hello" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Hello');
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<EmbedImageWatermark showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showTextInput=false 隐藏文字输入框', () => {
    render(<EmbedImageWatermark showTextInput={false} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无图片)', () => {
    render(<EmbedImageWatermark showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<EmbedImageWatermark showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<EmbedImageWatermark showDownloadButton={false} />);
    expect(screen.queryByText('quickWatermark.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<EmbedImageWatermark showResetButton={false} />);
    expect(screen.queryByText('quickWatermark.retry')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <EmbedImageWatermark theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-watermark') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<EmbedImageWatermark className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-watermark');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(
      <EmbedImageWatermark style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-watermark') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<EmbedImageWatermark components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 TextInput', () => {
    const CustomTextInput = () => <div data-testid="custom-text">custom text</div>;
    render(<EmbedImageWatermark components={{ TextInput: CustomTextInput }} />);
    expect(screen.getByTestId('custom-text')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<EmbedImageWatermark components={{ DownloadButton: CustomDownload }} />);
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
      <EmbedImageWatermark
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

  it('F1: mode="dark" 时根元素 data-quick-mode="dark"', () => {
    const { container } = render(<EmbedImageWatermark mode="dark" />);
    const root = container.querySelector('.lokvis-quick-watermark') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('dark');
  });

  it('F1: mode="light" 时根元素 data-quick-mode="light"', () => {
    const { container } = render(<EmbedImageWatermark mode="light" />);
    const root = container.querySelector('.lokvis-quick-watermark') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('light');
  });

  it('F2: busy=true 时渲染 processing 文案 + aria-busy', () => {
    setMockState({ busy: true });
    const { container } = render(<EmbedImageWatermark />);
    // processing 文案(t mock 返回 key 字符串)
    expect(screen.getByText('quickWatermark.processing')).toBeInTheDocument();
    // aria-busy
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it('F2: busy=false 时不渲染 processing 文案', () => {
    setMockState({ busy: false });
    render(<EmbedImageWatermark />);
    expect(screen.queryByText('quickWatermark.processing')).toBeNull();
  });

  it('F3: inputInfo 不为 null 时渲染文件信息(format · WxH · size)', () => {
    setMockState({
      inputInfo: { width: 1920, height: 1080, size: 2400000, format: 'PNG' },
    });
    render(<EmbedImageWatermark />);
    // format badge(PNG 大写)
    expect(screen.getByText('PNG')).toBeInTheDocument();
    // 尺寸
    expect(screen.getByText('1920×1080')).toBeInTheDocument();
  });

  it('F3: inputInfo=null 时不渲染文件信息', () => {
    setMockState({ inputInfo: null });
    render(<EmbedImageWatermark />);
    // 无 format badge(注意:placeholder "No image" 可能存在,但不应有 format)
    expect(screen.queryByText('PNG')).toBeNull();
  });

  it('F4: UploadBox 的 aria-label 使用 i18n dropHint 键', () => {
    render(<EmbedImageWatermark />);
    // t mock 返回 key 字符串,所以 aria-label = 'quickWatermark.dropHint'
    const uploadBtn = screen.getByRole('button', { name: 'quickWatermark.dropHint' });
    expect(uploadBtn).toBeInTheDocument();
  });
});

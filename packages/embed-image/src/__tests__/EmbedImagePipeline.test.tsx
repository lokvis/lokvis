/**
 * EmbedImagePipeline 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import EmbedImagePipeline from '../EmbedImagePipeline';

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

describe('EmbedImagePipeline 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-pipeline class', () => {
    const { container } = render(<EmbedImagePipeline />);
    const root = container.querySelector('.lokvis-quick-pipeline');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<EmbedImagePipeline />);
    expect(screen.getByText('quickPipeline.title')).toBeInTheDocument();
    expect(screen.getByText('quickPipeline.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 4 个预设按钮(radio)', () => {
    render(<EmbedImagePipeline />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('默认渲染 StepList(显示 steps 标签)', () => {
    render(<EmbedImagePipeline />);
    expect(screen.getByText('quickPipeline.steps')).toBeInTheDocument();
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<EmbedImagePipeline showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showStepList=false 隐藏步骤列表', () => {
    render(<EmbedImagePipeline showStepList={false} />);
    expect(screen.queryByText('quickPipeline.steps')).toBeNull();
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无图片)', () => {
    render(<EmbedImagePipeline showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('common.noImage');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<EmbedImagePipeline showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('common.noImage');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<EmbedImagePipeline showDownloadButton={false} />);
    expect(screen.queryByText('quickPipeline.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<EmbedImagePipeline showResetButton={false} />);
    expect(screen.queryByText('quickPipeline.retry')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <EmbedImagePipeline theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-pipeline') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<EmbedImagePipeline className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-pipeline');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(
      <EmbedImagePipeline style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-pipeline') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<EmbedImagePipeline components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 StepListBox', () => {
    const CustomStepList = () => <div data-testid="custom-steps">custom steps</div>;
    render(<EmbedImagePipeline components={{ StepListBox: CustomStepList }} />);
    expect(screen.getByTestId('custom-steps')).toBeInTheDocument();
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<EmbedImagePipeline components={{ DownloadButton: CustomDownload }} />);
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
      <EmbedImagePipeline
        components={{
          UploadBox: Replace,
          PreviewBox: () => <div data-testid="replaced" />,
          PresetSwitcher: Replace,
          StepListBox: Replace,
          DownloadButton: Replace,
          ErrorDisplay: Replace,
          ResetButton: Replace,
        }}
      />
    );
    expect(screen.getAllByTestId('replaced').length).toBeGreaterThanOrEqual(7);
  });

  it('F1: mode="dark" 时根元素 data-quick-mode="dark"', () => {
    const { container } = render(<EmbedImagePipeline mode="dark" />);
    const root = container.querySelector('.lokvis-quick-pipeline') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('dark');
  });

  it('F1: mode="light" 时根元素 data-quick-mode="light"', () => {
    const { container } = render(<EmbedImagePipeline mode="light" />);
    const root = container.querySelector('.lokvis-quick-pipeline') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('light');
  });

  it('F2: busy=true 时渲染 processing 文案 + aria-busy', () => {
    setMockState({ busy: true });
    const { container } = render(<EmbedImagePipeline />);
    // processing 文案(t mock 返回 key 字符串)
    expect(screen.getByText('quickPipeline.processing')).toBeInTheDocument();
    // aria-busy
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it('F2: busy=false 时不渲染 processing 文案', () => {
    setMockState({ busy: false });
    render(<EmbedImagePipeline />);
    expect(screen.queryByText('quickPipeline.processing')).toBeNull();
  });

  it('F3: inputInfo 不为 null 时渲染文件信息(format · WxH · size)', () => {
    setMockState({
      inputInfo: { width: 1920, height: 1080, size: 2400000, format: 'PNG' },
    });
    render(<EmbedImagePipeline />);
    // format badge(PNG 大写)
    expect(screen.getByText('PNG')).toBeInTheDocument();
    // 尺寸
    expect(screen.getByText('1920×1080')).toBeInTheDocument();
  });

  it('F3: inputInfo=null 时不渲染文件信息', () => {
    setMockState({ inputInfo: null });
    render(<EmbedImagePipeline />);
    // 无 format badge(注意:placeholder 'common.noImage' 可能存在,但不应有 format)
    expect(screen.queryByText('PNG')).toBeNull();
  });

  it('F4: UploadBox 的 aria-label 使用 i18n dropHint 键', () => {
    render(<EmbedImagePipeline />);
    // t mock 返回 key 字符串,所以 aria-label = 'quickPipeline.dropHint'
    const uploadBtn = screen.getByRole('button', { name: 'quickPipeline.dropHint' });
    expect(uploadBtn).toBeInTheDocument();
  });
});

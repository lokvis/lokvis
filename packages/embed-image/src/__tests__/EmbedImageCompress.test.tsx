/**
 * EmbedImageCompress 默认 UI(Layer 2)单测。
 *
 * 测试覆盖:
 *   - 默认渲染:标题 + 副标 + UploadBox + PresetSwitcher + Preview × 2 + footer
 *   - theme prop 转 CSS 变量(应用到根元素 style)
 *   - components prop 替换子组件
 *   - showPresetSwitcher / showBeforeAfter / showRatio / showDownloadButton / showResetButton
 *   - 外层 className / style 覆盖
 *
 * useImageTool 被整体 mock。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import EmbedImageCompress from '../EmbedImageCompress';

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

// useLang / useTranslations mock:返回固定翻译,避免 fallback 链干扰
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

// ─── 测试 ───────────────────────────────────────────────────

describe('EmbedImageCompress 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-compress class', () => {
    const { container } = render(<EmbedImageCompress />);
    const root = container.querySelector('.lokvis-quick-compress');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<EmbedImageCompress />);
    expect(screen.getByText('quickCompress.title')).toBeInTheDocument();
    expect(screen.getByText('quickCompress.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 3 个预设按钮(radio)', () => {
    render(<EmbedImageCompress />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<EmbedImageCompress showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无 input)', () => {
    render(<EmbedImageCompress showBeforeAfter={false} />);
    // 无图片时 preview 显示 "No image",showBeforeAfter=false 应只有 1 个
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview(input + output)', () => {
    render(<EmbedImageCompress showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<EmbedImageCompress showDownloadButton={false} />);
    expect(screen.queryByText('quickCompress.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<EmbedImageCompress showResetButton={false} />);
    expect(screen.queryByText('quickCompress.retry')).toBeNull();
  });

  it('showRatio=false 时,即使有输出也不显示压缩率', () => {
    setMockState({
      inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      outputInfo: { width: 800, height: 600, size: 300, format: 'WEBP' },
    });
    render(<EmbedImageCompress showRatio={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <EmbedImageCompress theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-compress') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
    // 未提供的字段不应生成
    expect(root.style.getPropertyValue('--lokvis-surface')).toBe('');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<EmbedImageCompress className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-compress');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素(覆盖 theme)', () => {
    const { container } = render(
      <EmbedImageCompress style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-compress') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<EmbedImageCompress components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    // 默认 UploadBox 不应出现
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<EmbedImageCompress components={{ DownloadButton: CustomDownload }} />);
    expect(screen.getByTestId('custom-download')).toBeInTheDocument();
  });

  it('components prop 替换所有子组件', () => {
    // 用精确类型替代 any:覆盖所有 slot 可能传入的 prop(children/type/className/style)。
    // 所有 slot 的 prop 接口字段都是上述子集,ReplaceProps 是它们的公共超类型,
    // 因此 ComponentType<ReplaceProps> 可赋值给 ComponentType<具体 slot prop>。
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
      <EmbedImageCompress
        components={{
          UploadBox: Replace,
          PreviewBox: () => <div data-testid="replaced" />,
          PresetSwitcher: Replace,
          DownloadButton: Replace,
          RatioBadge: Replace,
          ErrorDisplay: Replace,
          ResetButton: Replace,
        }}
      />
    );
    // 7 个子组件都被替换
    expect(screen.getAllByTestId('replaced').length).toBeGreaterThanOrEqual(7);
  });

  it('F1: mode="dark" 时根元素 data-quick-mode="dark"', () => {
    const { container } = render(<EmbedImageCompress mode="dark" />);
    const root = container.querySelector('.lokvis-quick-compress') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('dark');
  });

  it('F1: mode="light" 时根元素 data-quick-mode="light"', () => {
    const { container } = render(<EmbedImageCompress mode="light" />);
    const root = container.querySelector('.lokvis-quick-compress') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('light');
  });

  it('F2: busy=true 时渲染 processing 文案 + aria-busy', () => {
    setMockState({ busy: true });
    const { container } = render(<EmbedImageCompress />);
    // processing 文案(t mock 返回 key 字符串)
    expect(screen.getByText('quickCompress.processing')).toBeInTheDocument();
    // aria-busy
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it('F2: busy=false 时不渲染 processing 文案', () => {
    setMockState({ busy: false });
    render(<EmbedImageCompress />);
    expect(screen.queryByText('quickCompress.processing')).toBeNull();
  });

  it('F3: inputInfo 不为 null 时渲染文件信息(format · WxH · size)', () => {
    setMockState({
      inputInfo: { width: 1920, height: 1080, size: 2400000, format: 'PNG' },
    });
    render(<EmbedImageCompress />);
    // format badge(PNG 大写)
    expect(screen.getByText('PNG')).toBeInTheDocument();
    // 尺寸
    expect(screen.getByText('1920×1080')).toBeInTheDocument();
  });

  it('F3: inputInfo=null 时不渲染文件信息', () => {
    setMockState({ inputInfo: null });
    render(<EmbedImageCompress />);
    // 无 format badge(注意:placeholder "No image" 可能存在,但不应有 format)
    expect(screen.queryByText('PNG')).toBeNull();
  });

  it('F4: UploadBox 的 aria-label 使用 i18n dropHint 键', () => {
    render(<EmbedImageCompress />);
    // t mock 返回 key 字符串,所以 aria-label = 'quickCompress.dropHint'
    const uploadBtn = screen.getByRole('button', { name: 'quickCompress.dropHint' });
    expect(uploadBtn).toBeInTheDocument();
  });
});

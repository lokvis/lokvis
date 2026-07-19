/**
 * ImageQuickCompress 默认 UI(Layer 2)单测。
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
import type { UseImageToolResult } from '@/components/toolkit/useImageTool';
import ImageQuickCompress from '../ImageQuickCompress';

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('@/components/toolkit/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

// useLang / useTranslations mock:返回固定翻译,避免 fallback 链干扰
vi.mock('@/i18n/useLang', () => ({
  useLang: () => 'en',
}));

vi.mock('@/i18n/utils', () => ({
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

// ─── 测试 ───────────────────────────────────────────────────

describe('ImageQuickCompress 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-compress class', () => {
    const { container } = render(<ImageQuickCompress />);
    const root = container.querySelector('.lokvis-quick-compress');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<ImageQuickCompress />);
    expect(screen.getByText('quickCompress.title')).toBeInTheDocument();
    expect(screen.getByText('quickCompress.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 3 个预设按钮(radio)', () => {
    render(<ImageQuickCompress />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('默认渲染 UploadBox(role=button)', () => {
    render(<ImageQuickCompress />);
    // UploadBox 是 role=button,有 ARIA label
    const uploadBtn = screen.getByRole('button', { name: 'Upload image' });
    expect(uploadBtn).toBeInTheDocument();
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<ImageQuickCompress showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无 input)', () => {
    render(<ImageQuickCompress showBeforeAfter={false} />);
    // 无图片时 preview 显示 "No image",showBeforeAfter=false 应只有 1 个
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview(input + output)', () => {
    render(<ImageQuickCompress showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<ImageQuickCompress showDownloadButton={false} />);
    expect(screen.queryByText('quickCompress.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<ImageQuickCompress showResetButton={false} />);
    expect(screen.queryByText('quickCompress.retry')).toBeNull();
  });

  it('showRatio=false 时,即使有输出也不显示压缩率', () => {
    setMockState({
      inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      outputInfo: { width: 800, height: 600, size: 300, format: 'WEBP' },
    });
    render(<ImageQuickCompress showRatio={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <ImageQuickCompress theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-compress') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
    // 未提供的字段不应生成
    expect(root.style.getPropertyValue('--lokvis-surface')).toBe('');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<ImageQuickCompress className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-compress');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素(覆盖 theme)', () => {
    const { container } = render(
      <ImageQuickCompress style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-compress') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<ImageQuickCompress components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    // 默认 UploadBox 不应出现
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<ImageQuickCompress components={{ DownloadButton: CustomDownload }} />);
    expect(screen.getByTestId('custom-download')).toBeInTheDocument();
  });

  it('components prop 替换所有子组件', () => {
    // 使用 any 兼容多种 prop 形态(部分子组件契约无 children)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Replace: React.ComponentType<any> = ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="replaced">{children ?? 'replaced'}</div>
    );
    render(
      <ImageQuickCompress
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
});

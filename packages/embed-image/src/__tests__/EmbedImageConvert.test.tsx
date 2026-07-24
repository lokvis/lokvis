/**
 * EmbedImageConvert 默认 UI(Layer 2)单测。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import EmbedImageConvert from '../EmbedImageConvert';
import { detectEncodeSupport } from '../internal/format-support';

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

// jsdom 不实现 canvas.toBlob,真实 detectEncodeSupport 会挂起并泄漏控制台错误。
// mock 为"全部格式支持",与测试"浏览器能力齐全"的假设一致。
vi.mock('../internal/format-support', () => ({
  detectEncodeSupport: vi.fn(async (formats: readonly string[]) => {
    const support: Record<string, boolean> = {};
    for (const fmt of formats) {
      support[fmt] = true;
    }
    return support;
  }),
}));

// wasm 兜底开关 mock:默认关闭,慢速提示专项用例按需 mockReturnValue(true)。
const wasmEncodersEnabledMock = vi.fn(() => false);
vi.mock('@lokvis/engine-image', () => ({
  wasmEncodersEnabled: () => wasmEncodersEnabledMock(),
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
  wasmEncodersEnabledMock.mockReset();
  wasmEncodersEnabledMock.mockReturnValue(false);
}

describe('EmbedImageConvert 默认 UI', () => {
  beforeEach(() => {
    resetMocks();
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染根元素 .lokvis-quick-convert class', () => {
    const { container } = render(<EmbedImageConvert />);
    const root = container.querySelector('.lokvis-quick-convert');
    expect(root).not.toBeNull();
  });

  it('渲染标题与副标', () => {
    render(<EmbedImageConvert />);
    expect(screen.getByText('quickConvert.title')).toBeInTheDocument();
    expect(screen.getByText('quickConvert.subtitle')).toBeInTheDocument();
  });

  it('默认渲染 4 个预设按钮(radio)', () => {
    render(<EmbedImageConvert />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('showPresetSwitcher=false 隐藏预设切换器', () => {
    render(<EmbedImageConvert showPresetSwitcher={false} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('showBeforeAfter=false 时只渲染 1 个 preview(无图片)', () => {
    render(<EmbedImageConvert showBeforeAfter={false} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(1);
  });

  it('showBeforeAfter=true 时渲染 2 个 preview', () => {
    render(<EmbedImageConvert showBeforeAfter={true} />);
    const placeholders = screen.getAllByText('No image');
    expect(placeholders).toHaveLength(2);
  });

  it('showDownloadButton=false 时,即使有输出也不显示下载按钮', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    render(<EmbedImageConvert showDownloadButton={false} />);
    expect(screen.queryByText('quickConvert.download')).toBeNull();
  });

  it('showResetButton=false 时隐藏重置按钮', () => {
    render(<EmbedImageConvert showResetButton={false} />);
    expect(screen.queryByText('quickConvert.retry')).toBeNull();
  });

  it('showFormat=false 时,即使有输出也不显示格式徽章', () => {
    setMockState({
      inputInfo: { width: 100, height: 100, size: 1000, format: 'PNG' },
      outputInfo: { width: 100, height: 100, size: 500, format: 'WEBP' },
    });
    render(<EmbedImageConvert showFormat={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('theme prop 转 CSS 变量,应用到根元素', () => {
    const { container } = render(
      <EmbedImageConvert theme={{ primary: '#00ff00', radius: '0' }} />
    );
    const root = container.querySelector('.lokvis-quick-convert') as HTMLElement;
    expect(root.style.getPropertyValue('--lokvis-primary')).toBe('#00ff00');
    expect(root.style.getPropertyValue('--lokvis-radius')).toBe('0');
  });

  it('外层 className 追加到根元素', () => {
    const { container } = render(<EmbedImageConvert className="my-custom-class" />);
    const root = container.querySelector('.lokvis-quick-convert');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  it('外层 style 合并到根元素', () => {
    const { container } = render(
      <EmbedImageConvert style={{ margin: '20px' }} />
    );
    const root = container.querySelector('.lokvis-quick-convert') as HTMLElement;
    expect(root.style.margin).toBe('20px');
  });

  it('components prop 替换 UploadBox', () => {
    const CustomUpload = () => <div data-testid="custom-upload">custom upload</div>;
    render(<EmbedImageConvert components={{ UploadBox: CustomUpload }} />);
    expect(screen.getByTestId('custom-upload')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload image' })).toBeNull();
  });

  it('components prop 替换 DownloadButton', () => {
    setMockState({ outputBlob: new Blob(['x'], { type: 'image/webp' }) });
    const CustomDownload = () => <button data-testid="custom-download">custom download</button>;
    render(<EmbedImageConvert components={{ DownloadButton: CustomDownload }} />);
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
      <EmbedImageConvert
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

  it('F1: mode="dark" 时根元素 data-quick-mode="dark"', () => {
    const { container } = render(<EmbedImageConvert mode="dark" />);
    const root = container.querySelector('.lokvis-quick-convert') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('dark');
  });

  it('F1: mode="light" 时根元素 data-quick-mode="light"', () => {
    const { container } = render(<EmbedImageConvert mode="light" />);
    const root = container.querySelector('.lokvis-quick-convert') as HTMLElement;
    expect(root.getAttribute('data-quick-mode')).toBe('light');
  });

  it('F2: busy=true 时渲染 processing 文案 + aria-busy', () => {
    setMockState({ busy: true });
    const { container } = render(<EmbedImageConvert />);
    // processing 文案(t mock 返回 key 字符串)
    expect(screen.getByText('quickConvert.processing')).toBeInTheDocument();
    // aria-busy
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it('F2: busy=false 时不渲染 processing 文案', () => {
    setMockState({ busy: false });
    render(<EmbedImageConvert />);
    expect(screen.queryByText('quickConvert.processing')).toBeNull();
  });

  it('F3: inputInfo 不为 null 时渲染文件信息(format · WxH · size)', () => {
    setMockState({
      inputInfo: { width: 1920, height: 1080, size: 2400000, format: 'PNG' },
    });
    render(<EmbedImageConvert />);
    // format badge(PNG 大写)—— 限定 span,避免匹配到 PNG 预设按钮(button)
    expect(screen.getByText('PNG', { selector: 'span' })).toBeInTheDocument();
    // 尺寸
    expect(screen.getByText('1920×1080')).toBeInTheDocument();
  });

  it('F3: inputInfo=null 时不渲染文件信息', () => {
    setMockState({ inputInfo: null });
    render(<EmbedImageConvert />);
    // 无 format badge(PNG 预设按钮始终存在,故限定 span 只查文件信息栏)
    expect(screen.queryByText('PNG', { selector: 'span' })).toBeNull();
  });

  it('F4: UploadBox 的 aria-label 使用 i18n dropHint 键', () => {
    render(<EmbedImageConvert />);
    // t mock 返回 key 字符串,所以 aria-label = 'quickConvert.dropHint'
    const uploadBtn = screen.getByRole('button', { name: 'quickConvert.dropHint' });
    expect(uploadBtn).toBeInTheDocument();
  });

  describe('慢速编码提示条', () => {
    // 探测 promise 立即 resolve,刷新一轮微任务即可让 nativeSupport 落定
    async function flushDetection() {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    it('选中 avif 且仅 wasm 可用(原生不支持 + wasm 启用)→ 渲染慢速提示', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      render(<EmbedImageConvert initialPreset="avif" />);
      expect(await screen.findByText('quickConvert.slowEncoder')).toBeInTheDocument();
    });

    it('原生支持 avif → 不渲染慢速提示', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: true,
        jpeg: true,
      });
      render(<EmbedImageConvert initialPreset="avif" />);
      await flushDetection();
      expect(screen.queryByText('quickConvert.slowEncoder')).toBeNull();
    });

    it('wasm 关闭 + 原生不支持 avif → 不渲染慢速提示(预设被禁用)', async () => {
      wasmEncodersEnabledMock.mockReturnValue(false);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      render(<EmbedImageConvert initialPreset="avif" />);
      await flushDetection();
      expect(screen.queryByText('quickConvert.slowEncoder')).toBeNull();
    });

    it('默认 webp 预设时即使 wasm 启用也不显示提示(仅 avif 慢)', async () => {
      wasmEncodersEnabledMock.mockReturnValue(true);
      vi.mocked(detectEncodeSupport).mockResolvedValueOnce({
        png: true,
        webp: true,
        avif: false,
        jpeg: true,
      });
      render(<EmbedImageConvert />);
      await flushDetection();
      expect(screen.queryByText('quickConvert.slowEncoder')).toBeNull();
    });
  });
});

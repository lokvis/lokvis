/**
 * Layer-2 默认 UI 的 i18n 接线 + BusyOverlay/FileInfoBar slot 替换单测(P2-5)。
 *
 * 与 EmbedImageCompress.test.tsx 不同,本文件 **不 mock** useLang/useTranslations,
 * 走真实字典(ui.ts),验证:
 *   - locale prop 驱动预设按钮 / 上传提示 / 占位符 / 压缩率前后缀的翻译
 *   - translations prop 覆盖字典
 *   - components.BusyOverlay / components.FileInfoBar slot 替换后收到正确 props
 *
 * useImageTool 仍被整体 mock(不依赖真实引擎)。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import { ui } from '../i18n/ui';
import EmbedImageCompress from '../EmbedImageCompress';
import EmbedImageWatermark from '../EmbedImageWatermark';
import EmbedImageCrop from '../EmbedImageCrop';
import EmbedImagePipeline from '../EmbedImagePipeline';
import EmbedImageFavicon from '../EmbedImageFavicon';

// jsdom 不实现 matchMedia,useEmbedMode(mode='system') 需要它
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

// ─── mock useImageTool(仅 mock 引擎层,i18n 走真实字典) ─────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

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
    handleFiles: vi.fn(),
    runWorkflow: vi.fn(),
    runWorkflowRaw: vi.fn(),
    reset: vi.fn(),
    clearError: vi.fn(),
    commitOutput: vi.fn(),
    ...overrides,
  };
}

// ─── i18n 渲染 ──────────────────────────────────────────────

describe('Layer-2 i18n 渲染(真实字典)', () => {
  beforeEach(() => {
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  describe('EmbedImageCompress', () => {
    it('locale="zh" 时预设按钮渲染中文标签', () => {
      render(<EmbedImageCompress locale="zh" />);
      expect(screen.getByRole('radio', { name: '均衡' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '高质量' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '小体积' })).toBeInTheDocument();
    });

    it('locale="en" 时预设按钮渲染英文标签', () => {
      render(<EmbedImageCompress locale="en" />);
      expect(screen.getByRole('radio', { name: 'Balanced' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'High Quality' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Small' })).toBeInTheDocument();
    });

    it('locale="zh" 时上传提示与占位符使用中文', () => {
      render(<EmbedImageCompress locale="zh" />);
      expect(screen.getByRole('button', { name: '点击或拖入图片' })).toBeInTheDocument();
      // input + output 两个 preview 占位
      expect(screen.getAllByText('暂无图片')).toHaveLength(2);
    });

    it('locale="zh" 时压缩率使用「已节省」前缀', () => {
      setMockState({
        inputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
        outputInfo: { width: 800, height: 600, size: 300, format: 'WEBP' },
      });
      render(<EmbedImageCompress locale="zh" />);
      expect(screen.getByRole('status')).toHaveTextContent('已节省 70.0%');
    });

    it('locale="zh" 时体积增大使用「增加了」前缀', () => {
      setMockState({
        inputInfo: { width: 800, height: 600, size: 300, format: 'WEBP' },
        outputInfo: { width: 800, height: 600, size: 1000, format: 'PNG' },
      });
      render(<EmbedImageCompress locale="zh" />);
      expect(screen.getByRole('status')).toHaveTextContent('增加了 233.3%');
    });

    it('translations prop 覆盖字典文案', () => {
      render(
        <EmbedImageCompress
          locale="zh"
          translations={{ 'common.noImage': { zh: '没有图片自定义' } }}
        />
      );
      expect(screen.getAllByText('没有图片自定义')).toHaveLength(2);
      expect(screen.queryByText('暂无图片')).toBeNull();
    });
  });

  describe('EmbedImageWatermark', () => {
    it('locale="zh" 时预设按钮与输入框占位使用中文', () => {
      render(<EmbedImageWatermark locale="zh" />);
      expect(screen.getByRole('radio', { name: '右下角小字' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '居中大字' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '平铺' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('水印文字')).toBeInTheDocument();
    });
  });

  describe('EmbedImageCrop', () => {
    it('locale="zh" 时预设按钮渲染中文标签', () => {
      render(<EmbedImageCrop locale="zh" />);
      expect(screen.getByRole('radio', { name: '1:1 正方形' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '自由' })).toBeInTheDocument();
    });
  });

  describe('EmbedImagePipeline', () => {
    it('locale="zh" 时预设按钮渲染中文标签', () => {
      // 注:emptySteps 空状态仅在 workflow 无节点时渲染,内置预设均有节点,
      // 无法经默认组件触达——该 key 的 6 语言完整性由下方字典测试覆盖。
      render(<EmbedImagePipeline locale="zh" />);
      expect(screen.getByRole('radio', { name: '电商主图' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '社交分享' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '网页缩略图' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '博客配图' })).toBeInTheDocument();
    });
  });

  describe('EmbedImageFavicon', () => {
    it('locale="zh" 时预设按钮渲染中文标签(经父级 presetLabels 注入)', () => {
      render(<EmbedImageFavicon locale="zh" />);
      expect(screen.getByRole('radio', { name: '标准' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '现代' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '全兼容' })).toBeInTheDocument();
    });
  });
});

// ─── BusyOverlay / FileInfoBar slot 替换 ─────────────────────

describe('BusyOverlay / FileInfoBar slot 替换', () => {
  beforeEach(() => {
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('components.BusyOverlay 替换后收到 busy 与翻译后的 label', () => {
    setMockState({ busy: true });
    render(
      <EmbedImageCompress
        locale="zh"
        components={{
          BusyOverlay: ({ busy, label }) => (
            <div data-testid="custom-overlay">
              {String(busy)}:{label}
            </div>
          ),
        }}
      />
    );
    // 自定义 overlay 收到 busy=true + zh processing 文案
    expect(screen.getByTestId('custom-overlay')).toHaveTextContent('true:压缩中…');
    // 默认 BusyOverlay 的 aria-busy 容器不应出现
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('components.FileInfoBar 替换后收到 inputInfo / outputInfo', () => {
    setMockState({
      inputInfo: { width: 1920, height: 1080, size: 2400000, format: 'PNG' },
      outputInfo: null,
    });
    render(
      <EmbedImageCompress
        components={{
          FileInfoBar: ({ info }) => (
            <div data-testid="custom-info">
              {info ? `${info.format} ${info.width}×${info.height}` : 'empty'}
            </div>
          ),
        }}
      />
    );
    const infos = screen.getAllByTestId('custom-info');
    // input + output 两处 FileInfoBar 都被替换
    expect(infos).toHaveLength(2);
    expect(infos[0]).toHaveTextContent('PNG 1920×1080');
    expect(infos[1]).toHaveTextContent('empty');
    // 默认 FileInfoBar 的 format badge 不应出现
    expect(screen.queryByText('PNG', { selector: 'span' })).toBeNull();
  });
});

// ─── 字典完整性(P2-5 新增 key) ─────────────────────────────

describe('P2-5 新增 i18n key 的 6 语言完整性', () => {
  const NEW_KEYS = [
    'common.dropHere',
    'common.noImage',
    'common.ratioSaved',
    'common.ratioIncreased',
    'quickPipeline.emptySteps',
  ] as const;
  const LANGS = ['en', 'zh', 'ja', 'es', 'de', 'fr'] as const;

  it.each(NEW_KEYS)('%s 在 6 语言下均有非空翻译', (key) => {
    const entry = ui[key];
    expect(entry, `字典缺少 key: ${key}`).toBeDefined();
    for (const lang of LANGS) {
      expect(entry?.[lang], `${key}.${lang} 缺失或为空`).toBeTruthy();
    }
  });
});

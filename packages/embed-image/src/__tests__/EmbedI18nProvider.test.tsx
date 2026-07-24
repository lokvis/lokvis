/**
 * EmbedI18nProvider + locale prop i18n 解耦单测(Task 2)。
 *
 * 测试覆盖:
 *   - EmbedI18nProvider 注入 locale:Layer 2 默认 UI 使用 Provider 的 locale
 *   - locale prop 覆盖 Provider(优先级 1 > 2)
 *   - locale prop 在无 Provider 时生效(优先级 1 > 3/4 自动检测)
 *   - translations 覆盖:Provider.translations 与组件 translations prop
 *   - translations prop 覆盖 Provider.translations(优先级 1 > 2)
 *   - useLang 优先级链:explicit > Provider > 自动检测
 *   - t() 函数:overrides 优先,缺失时回退到包内字典
 *
 * useImageTool 被整体 mock,只验证 i18n 解耦逻辑。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UseImageToolResult } from '../internal/useImageTool';
import EmbedImageCompress from '../EmbedImageCompress';
import { EmbedI18nProvider, useQuickI18nContext } from '../i18n/EmbedI18nProvider';
import { useLang } from '../i18n/useLang';
import { useTranslations, t } from '../i18n/utils';
import type { Language } from '../i18n/config';

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

// ─── mock useImageTool ─────────────────────────────────────

const stateRef: { current: UseImageToolResult } = {
  current: {} as UseImageToolResult,
};

vi.mock('../internal/useImageTool', () => ({
  useImageTool: () => stateRef.current,
}));

// 注意:不 mock useLang / useTranslations —— 测试真实的 Provider 解耦逻辑

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
    ...overrides,
  };
}

// ─── 测试 ───────────────────────────────────────────────────

describe('EmbedI18nProvider i18n 解耦', () => {
  beforeEach(() => {
    setMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it('Provider 注入 locale=zh:Layer 2 渲染中文标题', () => {
    render(
      <EmbedI18nProvider locale="zh">
        <EmbedImageCompress />
      </EmbedI18nProvider>
    );
    expect(screen.getByText('一键压缩')).toBeInTheDocument();
  });

  it('Provider 注入 locale=ja:Layer 2 渲染日文标题', () => {
    render(
      <EmbedI18nProvider locale="ja">
        <EmbedImageCompress />
      </EmbedI18nProvider>
    );
    expect(screen.getByText('クイック圧縮')).toBeInTheDocument();
  });

  it('locale prop 覆盖 Provider(优先级 1 > 2)', () => {
    render(
      <EmbedI18nProvider locale="zh">
        <EmbedImageCompress locale="ja" />
      </EmbedI18nProvider>
    );
    // prop 覆盖 Provider,渲染日文
    expect(screen.getByText('クイック圧縮')).toBeInTheDocument();
    expect(screen.queryByText('一键压缩')).toBeNull();
  });

  it('locale prop 在无 Provider 时生效(优先级 1 > 3/4 自动检测)', () => {
    render(<EmbedImageCompress locale="de" />);
    expect(screen.getByText('Schnelle Komprimierung')).toBeInTheDocument();
  });

  it('无 Provider 无 prop:回退到包内默认字典(en)', () => {
    // jsdom 默认无 document.documentElement.lang,URL 也无 lang 前缀
    render(<EmbedImageCompress />);
    expect(screen.getByText('Quick Compress')).toBeInTheDocument();
  });

  it('Provider.translations 覆盖包内字典', () => {
    render(
      <EmbedI18nProvider
        locale="zh"
        translations={{ 'quickCompress.title': { zh: '我的自定义压缩' } }}
      >
        <EmbedImageCompress />
      </EmbedI18nProvider>
    );
    expect(screen.getByText('我的自定义压缩')).toBeInTheDocument();
  });

  it('translations prop 覆盖 Provider.translations(优先级 1 > 2)', () => {
    render(
      <EmbedI18nProvider
        locale="zh"
        translations={{ 'quickCompress.title': { zh: 'Provider 版本' } }}
      >
        <EmbedImageCompress
          translations={{ 'quickCompress.title': { zh: 'Prop 版本' } }}
        />
      </EmbedI18nProvider>
    );
    expect(screen.getByText('Prop 版本')).toBeInTheDocument();
    expect(screen.queryByText('Provider 版本')).toBeNull();
  });

  it('translations 覆盖只覆盖指定 key,其他 key 仍走包内字典', () => {
    render(
      <EmbedI18nProvider
        locale="zh"
        translations={{ 'quickCompress.title': { zh: '自定义标题' } }}
      >
        <EmbedImageCompress />
      </EmbedI18nProvider>
    );
    // title 被覆盖
    expect(screen.getByText('自定义标题')).toBeInTheDocument();
    // subtitle 仍走包内字典
    expect(screen.getByText('拖入图片 → 立即压缩为 WebP')).toBeInTheDocument();
  });

  it('translations 覆盖缺失 lang 时回退到 override 的 defaultLang(en)', () => {
    render(
      <EmbedI18nProvider
        locale="zh"
        translations={{ 'quickCompress.title': { en: 'en only override' } }}
      >
        <EmbedImageCompress />
      </EmbedI18nProvider>
    );
    // 覆盖表里没有 zh,但 override 优先级高于包内字典 → 回退到 override[en]
    expect(screen.getByText('en only override')).toBeInTheDocument();
  });

  it('useQuickI18nContext 无 Provider 时返回 null', () => {
    function Probe() {
      const ctx = useQuickI18nContext();
      return <div data-testid="probe">{ctx === null ? 'null' : 'has-ctx'}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('null');
  });

  it('useQuickI18nContext 在 Provider 内返回 context value', () => {
    function Probe() {
      const ctx = useQuickI18nContext();
      return (
        <div data-testid="probe">
          {ctx?.locale ?? 'no-locale'}|{ctx?.translations ? 'has-translations' : 'no-translations'}
        </div>
      );
    }
    render(
      <EmbedI18nProvider locale="fr" translations={{ foo: { fr: 'bar' } }}>
        <Probe />
      </EmbedI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('fr|has-translations');
  });
});

// ─── useLang 优先级链单测 ─────────────────────────────────

describe('useLang 优先级链', () => {
  afterEach(() => cleanup());

  function Probe({ locale }: { locale?: Language }) {
    const lang = useLang(locale);
    return <div data-testid="probe">{lang}</div>;
  }

  it('explicit locale 优先于 Provider', () => {
    render(
      <EmbedI18nProvider locale="zh">
        <Probe locale="ja" />
      </EmbedI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('ja');
  });

  it('无 explicit locale 时用 Provider locale', () => {
    render(
      <EmbedI18nProvider locale="zh">
        <Probe />
      </EmbedI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('zh');
  });

  it('无 explicit 无 Provider 时回退到自动检测(jsdom 默认 en)', () => {
    render(<Probe />);
    // jsdom 默认无 document.documentElement.lang,URL 也无 lang 前缀 → defaultLang(en)
    expect(screen.getByTestId('probe').textContent).toBe('en');
  });

  it('document.documentElement.lang 设置时被检测到', () => {
    const original = document.documentElement.lang;
    document.documentElement.lang = 'de';
    try {
      render(<Probe />);
      expect(screen.getByTestId('probe').textContent).toBe('de');
    } finally {
      document.documentElement.lang = original;
    }
  });
});

// ─── t() 函数单测 ─────────────────────────────────────────

describe('t() 翻译函数', () => {
  it('无 overrides:返回包内字典值', () => {
    expect(t('zh', 'quickCompress.title')).toBe('一键压缩');
    expect(t('en', 'quickCompress.title')).toBe('Quick Compress');
  });

  it('overrides 覆盖指定 key + lang', () => {
    const overrides = { 'quickCompress.title': { zh: '自定义' } };
    expect(t('zh', 'quickCompress.title', overrides)).toBe('自定义');
    // en 未覆盖,仍走包内
    expect(t('en', 'quickCompress.title', overrides)).toBe('Quick Compress');
  });

  it('overrides 覆盖的 key 缺失 lang 时回退到 override 的 defaultLang(en)', () => {
    const overrides = { 'quickCompress.title': { en: 'en only' } };
    // override 优先级高于包内字典 → 回退到 override[en] 而非包内 zh
    expect(t('zh', 'quickCompress.title', overrides)).toBe('en only');
  });

  it('不存在的 key 返回 key 本身', () => {
    expect(t('zh', 'nonexistent.key')).toBe('nonexistent.key');
    expect(t('zh', 'nonexistent.key', { 'other.key': { zh: 'x' } })).toBe('nonexistent.key');
  });

  it('lang 缺失 key 时回退到 defaultLang(en)', () => {
    // 包内所有 key 都有 6 语言,这里用 overrides 模拟部分缺失
    const overrides = { 'test.key': { en: 'en value' } };
    expect(t('zh', 'test.key', overrides)).toBe('en value');
  });
});

// ─── useTranslations hook 单测 ────────────────────────────

describe('useTranslations hook', () => {
  afterEach(() => cleanup());

  it('无 Provider:仅用包内字典', () => {
    function Probe() {
      const t = useTranslations('zh');
      return <div data-testid="probe">{t('quickCompress.title')}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('一键压缩');
  });

  it('有 Provider:用 Provider.translations 覆盖', () => {
    function Probe() {
      const t = useTranslations('zh');
      return <div data-testid="probe">{t('quickCompress.title')}</div>;
    }
    render(
      <EmbedI18nProvider
        locale="zh"
        translations={{ 'quickCompress.title': { zh: '覆盖版' } }}
      >
        <Probe />
      </EmbedI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('覆盖版');
  });
});

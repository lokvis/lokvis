/**
 * i18n 系统单测(@lokvis/embed-pdf)。
 *
 * 覆盖:
 *   - t() 翻译函数回退链
 *   - getLangFromUrl URL 路径解析
 *   - useTranslations hook(Provider 覆盖)
 *   - useLang 优先级链
 *   - localizePath / switchLangPath
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { t, getLangFromUrl, useTranslations, localizePath, switchLangPath } from '../i18n/utils';
import { useLang } from '../i18n/useLang';
import { EmbedPdfI18nProvider, usePdfI18nContext } from '../i18n/EmbedPdfI18nProvider';
import type { Language } from '../i18n/config';

// jsdom 不实现 matchMedia
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

// ─── t() 翻译函数 ─────────────────────────────────────────

describe('t() 翻译函数', () => {
  it('无 overrides 时返回包内字典值', () => {
    expect(t('zh', 'pdfCompress.title')).toBe('PDF 压缩');
    expect(t('en', 'pdfCompress.title')).toBe('PDF Compress');
    expect(t('ja', 'pdfMerge.title')).toBe('PDF 結合');
  });

  it('overrides 覆盖指定 key + lang', () => {
    const overrides = { 'pdfCompress.title': { zh: '自定义压缩' } };
    expect(t('zh', 'pdfCompress.title', overrides)).toBe('自定义压缩');
    // en 未覆盖,仍走包内
    expect(t('en', 'pdfCompress.title', overrides)).toBe('PDF Compress');
  });

  it('overrides 缺失目标 lang 时回退到 override 的 defaultLang(en)', () => {
    const overrides = { 'pdfCompress.title': { en: 'en only' } };
    expect(t('zh', 'pdfCompress.title', overrides)).toBe('en only');
  });

  it('不存在的 key 返回 key 本身', () => {
    expect(t('zh', 'nonexistent.key')).toBe('nonexistent.key');
    expect(t('en', 'foo.bar', { 'other.key': { en: 'x' } })).toBe('foo.bar');
  });

  it('所有 6 语言的 error.title 均有翻译', () => {
    const langs: Language[] = ['en', 'zh', 'ja', 'es', 'de', 'fr'];
    for (const lang of langs) {
      const result = t(lang, 'error.title');
      expect(result).not.toBe('error.title');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

// ─── getLangFromUrl ───────────────────────────────────────

describe('getLangFromUrl', () => {
  it('从完整 URL 提取语言前缀', () => {
    expect(getLangFromUrl('https://example.com/zh/tools/pdf')).toBe('zh');
    expect(getLangFromUrl('https://example.com/ja/pdf/compress')).toBe('ja');
  });

  it('从路径字符串提取语言前缀', () => {
    expect(getLangFromUrl('/de/pdf/merge')).toBe('de');
    expect(getLangFromUrl('/fr/tools')).toBe('fr');
  });

  it('无语言前缀时返回默认语言 en', () => {
    expect(getLangFromUrl('/tools/pdf')).toBe('en');
    expect(getLangFromUrl('/')).toBe('en');
    expect(getLangFromUrl('https://example.com/pdf/compress')).toBe('en');
  });

  it('不支持的语言代码返回 en', () => {
    expect(getLangFromUrl('/ko/pdf')).toBe('en');
    expect(getLangFromUrl('/pt/tools')).toBe('en');
  });

  it('接受 URL 对象', () => {
    expect(getLangFromUrl(new URL('https://example.com/es/pdf'))).toBe('es');
  });
});

// ─── localizePath / switchLangPath ────────────────────────

describe('localizePath / switchLangPath', () => {
  it('localizePath 在路径前插入语言前缀', () => {
    expect(localizePath('/pdf/compress', 'zh')).toBe('/zh/pdf/compress');
    expect(localizePath('pdf/compress', 'ja')).toBe('/ja/pdf/compress');
  });

  it('localizePath 已有语言前缀时不重复插入', () => {
    expect(localizePath('/zh/pdf/compress', 'en')).toBe('/zh/pdf/compress');
  });

  it('switchLangPath 替换语言前缀', () => {
    expect(switchLangPath('/zh/pdf/compress', 'en')).toBe('/en/pdf/compress');
    expect(switchLangPath('/en/tools', 'fr')).toBe('/fr/tools');
  });

  it('switchLangPath 无前缀时插入目标语言', () => {
    expect(switchLangPath('/pdf/compress', 'de')).toBe('/de/pdf/compress');
  });
});

// ─── useTranslations hook ─────────────────────────────────

describe('useTranslations hook', () => {
  afterEach(() => cleanup());

  it('无 Provider 时仅用包内字典', () => {
    function Probe() {
      const tr = useTranslations('zh');
      return <div data-testid="probe">{tr('pdfCompress.title')}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('PDF 压缩');
  });

  it('有 Provider 时用 Provider.translations 覆盖', () => {
    function Probe() {
      const tr = useTranslations('zh');
      return <div data-testid="probe">{tr('pdfCompress.title')}</div>;
    }
    render(
      <EmbedPdfI18nProvider
        locale="zh"
        translations={{ 'pdfCompress.title': { zh: '覆盖版' } }}
      >
        <Probe />
      </EmbedPdfI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('覆盖版');
  });

  it('explicitOverrides 优先于 Provider.translations', () => {
    function Probe() {
      const tr = useTranslations('zh', { 'pdfCompress.title': { zh: 'Prop 版' } });
      return <div data-testid="probe">{tr('pdfCompress.title')}</div>;
    }
    render(
      <EmbedPdfI18nProvider
        locale="zh"
        translations={{ 'pdfCompress.title': { zh: 'Provider 版' } }}
      >
        <Probe />
      </EmbedPdfI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('Prop 版');
  });
});

// ─── useLang 优先级链 ─────────────────────────────────────

describe('useLang 优先级链', () => {
  afterEach(() => cleanup());

  function Probe({ locale }: { locale?: Language }) {
    const lang = useLang(locale);
    return <div data-testid="probe">{lang}</div>;
  }

  it('explicit locale 优先于 Provider', () => {
    render(
      <EmbedPdfI18nProvider locale="zh">
        <Probe locale="ja" />
      </EmbedPdfI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('ja');
  });

  it('无 explicit locale 时用 Provider locale', () => {
    render(
      <EmbedPdfI18nProvider locale="zh">
        <Probe />
      </EmbedPdfI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('zh');
  });

  it('无 explicit 无 Provider 时回退到自动检测(jsdom 默认 en)', () => {
    render(<Probe />);
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

// ─── usePdfI18nContext ────────────────────────────────────

describe('usePdfI18nContext', () => {
  afterEach(() => cleanup());

  it('无 Provider 时返回 null', () => {
    function Probe() {
      const ctx = usePdfI18nContext();
      return <div data-testid="probe">{ctx === null ? 'null' : 'has-ctx'}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('null');
  });

  it('在 Provider 内返回 context value', () => {
    function Probe() {
      const ctx = usePdfI18nContext();
      return (
        <div data-testid="probe">
          {ctx?.locale ?? 'no-locale'}|{ctx?.translations ? 'has-translations' : 'no-translations'}
        </div>
      );
    }
    render(
      <EmbedPdfI18nProvider locale="fr" translations={{ foo: { fr: 'bar' } }}>
        <Probe />
      </EmbedPdfI18nProvider>
    );
    expect(screen.getByTestId('probe').textContent).toBe('fr|has-translations');
  });
});

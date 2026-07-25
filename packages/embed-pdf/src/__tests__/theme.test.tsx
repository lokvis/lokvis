/**
 * 主题系统单测(@lokvis/embed-pdf)。
 *
 * 覆盖:
 *   - themeToCssVars 输出
 *   - useEmbedPdfMode hook
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { themeToCssVars, useEmbedPdfMode, THEME_KEY_TO_VAR, type EmbedPdfTheme } from '../theme';

// ─── themeToCssVars ───────────────────────────────────────

describe('themeToCssVars', () => {
  it('未传 theme 时返回空对象', () => {
    expect(themeToCssVars(undefined)).toEqual({});
  });

  it('空对象时返回空对象', () => {
    expect(themeToCssVars({})).toEqual({});
  });

  it('primary 字段生成 --lokvis-pdf-primary', () => {
    const result = themeToCssVars({ primary: '#00ff00' }) as Record<string, string>;
    expect(result['--lokvis-pdf-primary']).toBe('#00ff00');
  });

  it('全部字段都生成对应 CSS 变量', () => {
    const theme: EmbedPdfTheme = {
      primary: '#00ff00',
      primaryHover: '#00cc00',
      background: '#1a1a1a',
      surface: '#222222',
      surfaceHover: '#333333',
      border: '#444444',
      text: '#ffffff',
      textMuted: '#888888',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      radius: '0',
      fontFamily: 'Inter, sans-serif',
      ring: '#818cf8',
    };
    const result = themeToCssVars(theme) as Record<string, string>;
    expect(result['--lokvis-pdf-primary']).toBe('#00ff00');
    expect(result['--lokvis-pdf-primary-hover']).toBe('#00cc00');
    expect(result['--lokvis-pdf-bg']).toBe('#1a1a1a');
    expect(result['--lokvis-pdf-surface']).toBe('#222222');
    expect(result['--lokvis-pdf-surface-hover']).toBe('#333333');
    expect(result['--lokvis-pdf-border']).toBe('#444444');
    expect(result['--lokvis-pdf-text']).toBe('#ffffff');
    expect(result['--lokvis-pdf-text-muted']).toBe('#888888');
    expect(result['--lokvis-pdf-success']).toBe('#10b981');
    expect(result['--lokvis-pdf-warning']).toBe('#f59e0b');
    expect(result['--lokvis-pdf-error']).toBe('#ef4444');
    expect(result['--lokvis-pdf-radius']).toBe('0');
    expect(result['--lokvis-pdf-font-family']).toBe('Inter, sans-serif');
    expect(result['--lokvis-pdf-ring']).toBe('#818cf8');
  });

  it('空字符串字段被忽略', () => {
    const result = themeToCssVars({ primary: '' }) as Record<string, string>;
    expect(result['--lokvis-pdf-primary']).toBeUndefined();
  });

  it('null 字段被忽略(运行时防御)', () => {
    const theme = JSON.parse('{"primary":null}') as EmbedPdfTheme;
    const result = themeToCssVars(theme) as Record<string, string>;
    expect(result['--lokvis-pdf-primary']).toBeUndefined();
  });

  it('THEME_KEY_TO_VAR 包含 14 个映射', () => {
    expect(Object.keys(THEME_KEY_TO_VAR)).toHaveLength(14);
  });
});

// ─── useEmbedPdfMode ──────────────────────────────────────

describe('useEmbedPdfMode', () => {
  afterEach(() => cleanup());

  function Probe({ mode }: { mode?: 'light' | 'dark' | 'system' }) {
    const resolved = useEmbedPdfMode(mode);
    return <div data-testid="probe">{resolved}</div>;
  }

  it('mode="light" 直接返回 light', () => {
    render(<Probe mode="light" />);
    expect(screen.getByTestId('probe').textContent).toBe('light');
  });

  it('mode="dark" 直接返回 dark', () => {
    render(<Probe mode="dark" />);
    expect(screen.getByTestId('probe').textContent).toBe('dark');
  });

  it('mode="system" 在 jsdom(无 matchMedia 匹配)时返回 light', () => {
    // jsdom 默认 matchMedia matches=false
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
    render(<Probe mode="system" />);
    expect(screen.getByTestId('probe').textContent).toBe('light');
  });

  it('mode="system" 在暗色偏好时返回 dark', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    try {
      render(<Probe mode="system" />);
      expect(screen.getByTestId('probe').textContent).toBe('dark');
    } finally {
      window.matchMedia = original;
    }
  });

  it('默认参数为 system', () => {
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
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('light');
  });
});

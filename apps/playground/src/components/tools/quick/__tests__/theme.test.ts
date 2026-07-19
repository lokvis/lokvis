/**
 * Quick Action 主题系统 themeToCssVars 单测。
 */
import { describe, it, expect } from 'vitest';
import { themeToCssVars, type QuickTheme } from '../theme';

describe('themeToCssVars', () => {
  it('未传 theme 时返回空对象', () => {
    expect(themeToCssVars(undefined)).toEqual({});
  });

  it('空对象时返回空对象', () => {
    expect(themeToCssVars({})).toEqual({});
  });

  it('primary 字段生成 --lokvis-primary', () => {
    const result = themeToCssVars({ primary: '#00ff00' } as QuickTheme) as Record<string, string>;
    expect(result['--lokvis-primary']).toBe('#00ff00');
  });

  it('全部字段都生成对应 CSS 变量', () => {
    const theme: QuickTheme = {
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
    };
    const result = themeToCssVars(theme) as Record<string, string>;
    expect(result['--lokvis-primary']).toBe('#00ff00');
    expect(result['--lokvis-primary-hover']).toBe('#00cc00');
    expect(result['--lokvis-bg']).toBe('#1a1a1a');
    expect(result['--lokvis-surface']).toBe('#222222');
    expect(result['--lokvis-surface-hover']).toBe('#333333');
    expect(result['--lokvis-border']).toBe('#444444');
    expect(result['--lokvis-text']).toBe('#ffffff');
    expect(result['--lokvis-text-muted']).toBe('#888888');
    expect(result['--lokvis-success']).toBe('#10b981');
    expect(result['--lokvis-warning']).toBe('#f59e0b');
    expect(result['--lokvis-error']).toBe('#ef4444');
    expect(result['--lokvis-radius']).toBe('0');
    expect(result['--lokvis-font-family']).toBe('Inter, sans-serif');
  });

  it('空字符串字段被忽略(回落到 global.css 默认值)', () => {
    const result = themeToCssVars({ primary: '' } as QuickTheme) as Record<string, string>;
    expect(result['--lokvis-primary']).toBeUndefined();
  });

  it('null 字段被忽略', () => {
    const result = themeToCssVars({ primary: null as unknown as string } as QuickTheme) as Record<string, string>;
    expect(result['--lokvis-primary']).toBeUndefined();
  });
});

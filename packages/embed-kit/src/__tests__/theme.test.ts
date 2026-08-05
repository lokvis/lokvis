import { describe, it, expect } from 'vitest';
import { makeThemeSystem } from '../theme.js';

describe('makeThemeSystem', () => {
  const { THEME_KEY_TO_VAR, themeToCssVars } = makeThemeSystem('--lokvis');

  it('THEME_KEY_TO_VAR 应以传入前缀构建 CSS 变量名', () => {
    expect(THEME_KEY_TO_VAR.primary).toBe('--lokvis-primary');
    expect(THEME_KEY_TO_VAR.primaryHover).toBe('--lokvis-primary-hover');
    expect(THEME_KEY_TO_VAR.background).toBe('--lokvis-bg');
    expect(THEME_KEY_TO_VAR.surface).toBe('--lokvis-surface');
    expect(THEME_KEY_TO_VAR.radius).toBe('--lokvis-radius');
    expect(THEME_KEY_TO_VAR.fontFamily).toBe('--lokvis-font-family');
  });

  it('不同前缀应生成不同的变量名', () => {
    const pdf = makeThemeSystem('--lokvis-pdf');
    expect(pdf.THEME_KEY_TO_VAR.primary).toBe('--lokvis-pdf-primary');
  });

  it('themeToCssVars 无参数时应返回空对象', () => {
    expect(themeToCssVars(undefined)).toEqual({});
  });

  it('themeToCssVars 应将 theme 对象映射为 CSS 变量', () => {
    const vars = themeToCssVars({ primary: '#6366f1', radius: '0.5rem' }) as Record<string, string>;
    expect(vars['--lokvis-primary']).toBe('#6366f1');
    expect(vars['--lokvis-radius']).toBe('0.5rem');
  });

  it('themeToCssVars 应跳过 undefined / 空字符串值', () => {
    const vars = themeToCssVars({ primary: '', surface: undefined, text: '#000' }) as Record<string, string>;
    expect(vars).not.toHaveProperty('--lokvis-primary');
    expect(vars).not.toHaveProperty('--lokvis-surface');
    expect(vars['--lokvis-text']).toBe('#000');
  });

  it('themeToCssVars 空对象应返回空结果', () => {
    expect(themeToCssVars({})).toEqual({});
  });
});

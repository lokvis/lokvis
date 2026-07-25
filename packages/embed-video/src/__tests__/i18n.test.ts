/**
 * i18n 工具函数单测。
 */
import { describe, it, expect } from 'vitest';
import { t, getLangFromUrl } from '../i18n/utils';

describe('getLangFromUrl', () => {
  it('从完整 URL 中提取语言前缀', () => {
    expect(getLangFromUrl('https://example.com/zh/tools')).toBe('zh');
  });

  it('从路径字符串中提取语言前缀', () => {
    expect(getLangFromUrl('/ja/video')).toBe('ja');
  });

  it('无语言前缀时回退到默认语言 en', () => {
    expect(getLangFromUrl('/tools/compress')).toBe('en');
  });

  it('不支持的语言代码回退到 en', () => {
    expect(getLangFromUrl('/xx/tools')).toBe('en');
  });

  it('接受 URL 对象', () => {
    expect(getLangFromUrl(new URL('https://example.com/fr/page'))).toBe('fr');
  });

  it('根路径回退到 en', () => {
    expect(getLangFromUrl('/')).toBe('en');
  });
});

describe('t', () => {
  it('返回对应语言的翻译', () => {
    expect(t('zh', 'videoCompress.title')).toBe('视频压缩');
    expect(t('en', 'videoCompress.title')).toBe('Video Compress');
  });

  it('缺失 key 时回退到 key 本身', () => {
    expect(t('en', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('overrides 优先于包内字典', () => {
    const overrides = { 'videoCompress.title': { zh: '自定义压缩' } };
    expect(t('zh', 'videoCompress.title', overrides)).toBe('自定义压缩');
  });

  it('overrides 缺失目标语言时回退到 defaultLang(en)', () => {
    const overrides = { 'videoCompress.title': { en: 'Custom Compress' } };
    expect(t('ja', 'videoCompress.title', overrides)).toBe('Custom Compress');
  });

  it('overrides 完全缺失时回退到包内字典', () => {
    const overrides = { 'other.key': { zh: '其他' } };
    expect(t('zh', 'videoCompress.title', overrides)).toBe('视频压缩');
  });

  it('所有 6 种语言均有 error.title 翻译', () => {
    const langs = ['en', 'zh', 'ja', 'es', 'de', 'fr'] as const;
    for (const lang of langs) {
      const result = t(lang, 'error.title');
      expect(result).not.toBe('error.title');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

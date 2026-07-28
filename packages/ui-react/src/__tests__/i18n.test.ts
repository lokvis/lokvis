/**
 * i18n 纯函数与字典单元测试
 *
 * 覆盖:
 * - 字典 6 语言完整性(每个 key 均含 en/zh/ja/es/de/fr,非空)
 * - {name} 占位符跨语言一致性(各语言占位符集合与 en 相同)
 * - t() 翻译回退链: overrides[lang] → overrides[en] → ui[lang] → ui[en] → key
 * - 参数插值(含缺参保留占位符)
 * - getLangFromUrl 路径前缀解析
 * - formatMessage(string 直通 / I18nMessage 翻译)
 */
import { describe, it, expect } from 'vitest';
import { languages, defaultLang, langList, type Language } from '../i18n/config.js';
import { ui } from '../i18n/ui.js';
import { t, getLangFromUrl, formatMessage, type TranslateFn } from '../i18n/utils.js';

const PLACEHOLDER_RE = /\{(\w+)\}/g;

function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]!).sort();
}

describe('i18n 语言配置', () => {
  it('支持 6 种语言,默认 en', () => {
    expect(langList).toEqual(['en', 'zh', 'ja', 'es', 'de', 'fr']);
    expect(defaultLang).toBe('en');
    expect(Object.keys(languages)).toHaveLength(6);
  });
});

describe('ui 字典完整性', () => {
  const keys = Object.keys(ui);

  it('字典非空', () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  it('每个 key 均包含全部 6 种语言且文案非空', () => {
    for (const key of keys) {
      const entry = ui[key]!;
      for (const lang of langList) {
        expect(entry[lang], `${key}.${lang} 缺失`).toBeTypeOf('string');
        expect(entry[lang].trim(), `${key}.${lang} 为空`).not.toBe('');
      }
    }
  });

  it('各语言 {name} 占位符集合与 en 一致', () => {
    for (const key of keys) {
      const entry = ui[key]!;
      const expected = placeholders(entry.en);
      for (const lang of langList) {
        expect(placeholders(entry[lang]), `${key}.${lang} 占位符与 en 不一致`).toEqual(expected);
      }
    }
  });
});

describe('t() 翻译函数', () => {
  it('返回对应语言的文案', () => {
    expect(t('en', 'status.idle')).toBe('Idle');
    expect(t('zh', 'status.idle')).toBe('空闲');
    expect(t('ja', 'status.ready')).toBe('準備完了');
  });

  it('未知 key 回退为 key 本身', () => {
    expect(t('zh', 'not.exists')).toBe('not.exists');
  });

  it('overrides 优先于包内字典', () => {
    expect(t('zh', 'status.idle', { 'status.idle': { zh: '闲置中' } })).toBe('闲置中');
  });

  it('overrides 缺当前语言时回退到 overrides 的 en', () => {
    expect(t('ja', 'status.idle', { 'status.idle': { en: 'Custom Idle' } })).toBe('Custom Idle');
  });

  it('overrides 完全无匹配时回退到包内字典', () => {
    expect(t('zh', 'status.ready', { 'status.idle': { zh: '闲置中' } })).toBe('就绪');
  });

  it('支持 {name} 参数插值', () => {
    expect(t('en', 'status.importing', undefined, { count: 3 })).toBe('Importing 3 file(s)...');
    expect(t('zh', 'status.imported', undefined, { count: 2 })).toBe('已导入 2 个文件');
  });

  it('缺失参数时保留占位符原样', () => {
    expect(t('en', 'status.importing', undefined, {})).toBe('Importing {count} file(s)...');
  });

  it('overrides 文案同样支持插值', () => {
    expect(
      t('zh', 'status.importing', { 'status.importing': { zh: '导入 {count} 项' } }, { count: 5 })
    ).toBe('导入 5 项');
  });
});

describe('getLangFromUrl', () => {
  it('解析路径前缀语言', () => {
    expect(getLangFromUrl('/zh/tools')).toBe('zh');
    expect(getLangFromUrl('/fr/')).toBe('fr');
  });

  it('支持完整 URL', () => {
    expect(getLangFromUrl('https://example.com/ja/editor')).toBe('ja');
    expect(getLangFromUrl(new URL('https://example.com/de/x'))).toBe('de');
  });

  it('协议相对 URL 不抛错并正确解析', () => {
    expect(getLangFromUrl('//example.com/zh/tools')).toBe('zh');
    expect(getLangFromUrl('//example.com/')).toBe('en');
  });

  it('非语言前缀回退到默认语言', () => {
    expect(getLangFromUrl('/')).toBe('en');
    expect(getLangFromUrl('/tools/resize')).toBe('en');
    expect(getLangFromUrl('https://example.com/xx/y')).toBe('en');
  });
});

describe('formatMessage', () => {
  const translate: TranslateFn = (key, params) => t('zh' as Language, key, undefined, params);

  it('I18nMessage 走字典翻译', () => {
    expect(formatMessage(translate, { key: 'status.imported', params: { count: 2 } })).toBe(
      '已导入 2 个文件'
    );
  });

  it('原始字符串(如 engine 错误文本)原样返回', () => {
    expect(formatMessage(translate, 'OOM: buffer too large')).toBe('OOM: buffer too large');
  });
});

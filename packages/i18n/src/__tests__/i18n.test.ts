/**
 * @lokvis/i18n 核心原语单元测试
 *
 * 覆盖:
 * - 语言配置(6 语言,默认 en)
 * - isLanguage / getLangFromUrl 路径前缀解析(含协议相对 URL)
 * - localizePath / switchLangPath
 * - interpolate 占位符插值(含缺参保留)
 * - translate 回退链: overrides[lang] → overrides[en] → dict[lang] → dict[en] → key
 * - pluralKey 复数规则(en / fr 0 的差异)
 */
import { describe, it, expect } from 'vitest';
import {
  languages,
  defaultLang,
  langList,
  isLanguage,
  getLangFromUrl,
  localizePath,
  switchLangPath,
  interpolate,
  translate,
  pluralKey,
  type TranslationDict,
} from '../index.js';

describe('语言配置', () => {
  it('支持 6 种语言,默认 en', () => {
    expect(langList).toEqual(['en', 'zh', 'ja', 'es', 'de', 'fr']);
    expect(defaultLang).toBe('en');
    expect(Object.keys(languages)).toHaveLength(6);
  });
});

describe('isLanguage', () => {
  it('识别受支持语言', () => {
    expect(isLanguage('zh')).toBe(true);
    expect(isLanguage('xx')).toBe(false);
  });
});

describe('getLangFromUrl', () => {
  it('解析路径前缀语言', () => {
    expect(getLangFromUrl('/zh/tools')).toBe('zh');
    expect(getLangFromUrl('/fr/')).toBe('fr');
  });

  it('支持完整 URL 与 URL 对象', () => {
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

describe('localizePath / switchLangPath', () => {
  it('无前缀路径插入 lang', () => {
    expect(localizePath('/tools', 'zh')).toBe('/zh/tools');
    expect(localizePath('tools', 'ja')).toBe('/ja/tools');
  });

  it('已有前缀路径保持不变', () => {
    expect(localizePath('/zh/tools', 'ja')).toBe('/zh/tools');
  });

  it('切换语言替换前缀', () => {
    expect(switchLangPath('/zh/tools', 'fr')).toBe('/fr/tools');
    expect(switchLangPath('/en', 'de')).toBe('/de/');
  });
});

describe('interpolate', () => {
  it('替换占位符', () => {
    expect(interpolate('Importing {count} file(s)', { count: 3 })).toBe('Importing 3 file(s)');
  });

  it('缺参保留占位符原样', () => {
    expect(interpolate('Importing {count} file(s)', {})).toBe('Importing {count} file(s)');
  });

  it('无参数直通', () => {
    expect(interpolate('plain text')).toBe('plain text');
  });
});

describe('translate', () => {
  const dict: TranslationDict = {
    'status.idle': { en: 'Idle', zh: '空闲', ja: 'アイドル', es: 'Inactivo', de: 'Leerlauf', fr: 'Inactif' },
    'status.importing': {
      en: 'Importing {count} file(s)...',
      zh: '正在导入 {count} 个文件...',
      ja: '{count} 個のファイルをインポート中...',
      es: 'Importando {count} archivo(s)...',
      de: 'Importiere {count} Datei(en)...',
      fr: 'Importation de {count} fichier(s)...',
    },
  };

  it('返回对应语言文案', () => {
    expect(translate(dict, 'en', 'status.idle')).toBe('Idle');
    expect(translate(dict, 'zh', 'status.idle')).toBe('空闲');
  });

  it('未知 key 回退为 key 本身', () => {
    expect(translate(dict, 'zh', 'not.exists')).toBe('not.exists');
  });

  it('overrides 优先于字典', () => {
    expect(translate(dict, 'zh', 'status.idle', { 'status.idle': { zh: '闲置中' } })).toBe('闲置中');
  });

  it('overrides 缺当前语言时回退到 overrides 的 en', () => {
    expect(translate(dict, 'ja', 'status.idle', { 'status.idle': { en: 'Custom' } })).toBe('Custom');
  });

  it('overrides 完全无匹配回退到字典', () => {
    expect(translate(dict, 'zh', 'status.idle', { 'other.key': { zh: 'x' } })).toBe('空闲');
  });

  it('支持参数插值', () => {
    expect(translate(dict, 'en', 'status.importing', undefined, { count: 3 })).toBe(
      'Importing 3 file(s)...'
    );
  });

  it('overrides 文案同样支持插值', () => {
    expect(
      translate(dict, 'zh', 'status.importing', { 'status.importing': { zh: '导入 {count} 项' } }, { count: 5 })
    ).toBe('导入 5 项');
  });
});

describe('pluralKey', () => {
  it('en: 1 为单数,其余复数', () => {
    expect(pluralKey('en', 'step', 1)).toBe('stepOne');
    expect(pluralKey('en', 'step', 0)).toBe('stepOther');
    expect(pluralKey('en', 'step', 2)).toBe('stepOther');
  });

  it('fr: 0 与 1 均为单数', () => {
    expect(pluralKey('fr', 'step', 0)).toBe('stepOne');
    expect(pluralKey('fr', 'step', 1)).toBe('stepOne');
    expect(pluralKey('fr', 'step', 2)).toBe('stepOther');
  });
});

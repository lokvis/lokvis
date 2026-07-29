/**
 * 字典翻译原语(@lokvis/i18n 核心)。
 *
 * 各消费包维护自己的 `ui` 字典(TranslationDict),共用此处的
 * translate / interpolate / pluralKey 逻辑,保证回退链与插值行为一致。
 *
 * 回退链:overrides[key][lang] → overrides[key][defaultLang]
 *        → dict[key][lang] → dict[key][defaultLang] → key 本身
 */
import { defaultLang, type Language } from './config.js';

/** 单个翻译条目:每种语言对应一条文案 */
export type TranslationEntry = Record<Language, string>;

/** 翻译字典:key → 各语言文案 */
export type TranslationDict = Record<string, TranslationEntry>;

/**
 * translate 接受的字典形态(条目允许缺语言)。
 * 严格的 TranslationDict 可赋值给它;playground 等允许部分语言的字典也可传入,
 * 缺失语言由回退链兜底。
 */
export type ReadableDict = Record<string, Partial<Record<Language, string>>>;

/** 消费方注入的翻译覆盖(允许只覆盖部分语言) */
export type TranslationOverrides = Record<string, Partial<Record<Language, string>>>;

/** 插值参数表:{name} 占位符 → 值 */
export type TranslateParams = Record<string, string | number>;

/** {name} 占位符插值(缺参时保留占位符原样) */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/**
 * 翻译函数:根据 dict + lang + key 返回对应字符串,支持 {name} 参数插值。
 *
 * @param dict 消费包的字典
 * @param lang 当前语言
 * @param key 翻译 key
 * @param overrides 消费方注入的翻译覆盖(可选)
 * @param params 插值参数(可选)
 */
export function translate(
  dict: ReadableDict,
  lang: Language,
  key: string,
  overrides?: TranslationOverrides,
  params?: TranslateParams
): string {
  const override = overrides?.[key];
  if (override) {
    const resolved = override[lang] ?? override[defaultLang];
    if (resolved) return interpolate(resolved, params);
  }
  const entry = dict[key]?.[lang] ?? dict[key]?.[defaultLang];
  if (entry !== undefined) return interpolate(entry, params);
  return key;
}

const pluralRulesCache = new Map<Language, Intl.PluralRules>();

/**
 * 按语言复数规则选择 `${base}One` / `${base}Other` key。
 *
 * 集中复数选择逻辑,避免组件内硬编码 `count === 1`
 * (如法语中 0 为单数:"0 étape" 而非 "0 étapes")。
 */
export function pluralKey(lang: Language, base: string, count: number): string {
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang);
    pluralRulesCache.set(lang, rules);
  }
  return rules.select(count) === 'one' ? `${base}One` : `${base}Other`;
}

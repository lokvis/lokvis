import { describe, it, expect } from 'vitest';
import { SNIPPETS, DEFAULT_SNIPPET_ID, findSnippet } from '../snippets';

/**
 * Playground 示例代码片段单测(W19.6)
 *
 * 覆盖:
 *  - SNIPPETS 数量与 id 唯一性
 *  - 每个 snippet 字段完整(label/desc/code 非空)
 *  - 代码末尾换行(供 Playground IIFE 包裹时安全)
 *  - findSnippet 默认 + 命中 + 未命中 fallback
 *  - DEFAULT_SNIPPET_ID 在 SNIPPETS 中
 */

describe('playground/snippets', () => {
  describe('SNIPPETS 数组', () => {
    it('至少有 5 个 snippet', () => {
      expect(SNIPPETS.length).toBeGreaterThanOrEqual(5);
    });

    it('所有 id 唯一', () => {
      const ids = SNIPPETS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个 snippet 字段完整(label/desc/code 非空字符串)', () => {
      for (const s of SNIPPETS) {
        expect(typeof s.id).toBe('string');
        expect(s.id.length).toBeGreaterThan(0);
        expect(typeof s.labelEn).toBe('string');
        expect(s.labelEn.length).toBeGreaterThan(0);
        expect(typeof s.labelZh).toBe('string');
        expect(s.labelZh.length).toBeGreaterThan(0);
        expect(typeof s.descEn).toBe('string');
        expect(s.descEn.length).toBeGreaterThan(0);
        expect(typeof s.descZh).toBe('string');
        expect(s.descZh.length).toBeGreaterThan(0);
        expect(typeof s.code).toBe('string');
        expect(s.code.length).toBeGreaterThan(0);
      }
    });

    it('每个 snippet 代码以换行结尾(IIFE 包裹安全)', () => {
      for (const s of SNIPPETS) {
        expect(s.code.endsWith('\n')).toBe(true);
      }
    });

    it('hello snippet 是首个(作为默认)', () => {
      expect(SNIPPETS[0]?.id).toBe('hello');
    });

    it('resize snippet 含 importAsset + run + exportAsset 三步', () => {
      const resize = SNIPPETS.find((s) => s.id === 'resize');
      expect(resize).toBeDefined();
      expect(resize!.code).toMatch(/importAsset/);
      expect(resize!.code).toMatch(/\.run\(/);
      expect(resize!.code).toMatch(/exportAsset/);
    });

    it('eventbus snippet 含 onAny 订阅', () => {
      const ev = SNIPPETS.find((s) => s.id === 'eventbus');
      expect(ev).toBeDefined();
      expect(ev!.code).toMatch(/eventBus\.onAny/);
    });

    it('factory snippet 含 createLokvis 调用', () => {
      const fac = SNIPPETS.find((s) => s.id === 'factory');
      expect(fac).toBeDefined();
      expect(fac!.code).toMatch(/createLokvis/);
    });
  });

  describe('DEFAULT_SNIPPET_ID', () => {
    it('值为 hello', () => {
      expect(DEFAULT_SNIPPET_ID).toBe('hello');
    });

    it('在 SNIPPETS 中存在', () => {
      expect(SNIPPETS.map((s) => s.id)).toContain(DEFAULT_SNIPPET_ID);
    });
  });

  describe('findSnippet', () => {
    it('命中已存在的 id 返回对应 snippet', () => {
      const snip = findSnippet('resize');
      expect(snip.id).toBe('resize');
    });

    it('未传入 id(null/undefined)返回首个(hello)', () => {
      expect(findSnippet(null).id).toBe('hello');
      expect(findSnippet(undefined).id).toBe('hello');
    });

    it('未命中的 id 返回首个(hello)作为 fallback', () => {
      expect(findSnippet('does-not-exist').id).toBe('hello');
      expect(findSnippet('').id).toBe('hello');
    });

    it('返回的对象引用与 SNIPPETS 中一致(便于 === 比较)', () => {
      const snip = findSnippet('eventbus');
      expect(snip).toBe(SNIPPETS.find((s) => s.id === 'eventbus'));
    });
  });
});

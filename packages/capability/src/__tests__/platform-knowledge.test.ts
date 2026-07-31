/**
 * 平台预设与 @lokvis/data-platforms 一致性守卫(C1)
 *
 * 双向守卫:
 * - 知识仓尺寸变更而 codegen 未重跑 → 本测试失败(提示 `pnpm codegen`);
 * - 有人手改 platform.generated.ts 的 knowledge 预设 → 本测试失败。
 *
 * 仅校验 `source: 'knowledge'` 预设的 width/height 与知识仓 `recommendedSize`
 * 逐字段相等;展示字段(platform/name/category 等)属 open 侧 opinion,不在此约束。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { KnowledgeBundle, PlatformRecord } from '@lokvis/data-platforms';
import { PLATFORM_PRESETS } from '../presets/platform.js';

// 包的 "default" 运行时条件是 dist/platforms.json,但 "types" 条件只声明命名导出,
// 故经 createRequire 解析 JSON 路径再读取(与 codegen-platform-presets.ts 一致)。
const require = createRequire(import.meta.url);
const bundle = JSON.parse(
  readFileSync(require.resolve('@lokvis/data-platforms'), 'utf8')
) as KnowledgeBundle<PlatformRecord>;

const records = bundle.records;

/** 知识仓规格(`${record.id}/${spec.key}`)→ 预设 id(与 codegen MAPPING 对齐) */
const MAPPING: Record<string, string> = {
  'platform:facebook/cover-photo': 'facebook.cover',
  'platform:facebook/profile-photo': 'facebook.profile',
  'platform:facebook/feed-image': 'facebook.post',
  'platform:favicon/favicon-ico': 'web.favicon',
  'platform:instagram/feed-portrait': 'instagram.portrait',
  'platform:instagram/story': 'instagram.story',
  'platform:shopify/product-image': 'shopify.product',
  'platform:wechat/article-cover': 'wechat.article',
  'platform:x-twitter/profile-photo': 'twitter.profile',
  'platform:x-twitter/header-photo': 'twitter.header',
  'platform:youtube/thumbnail': 'youtube.thumbnail',
  'platform:favicon/apple-touch-icon': 'favicon.apple-touch-icon',
};

function specSize(recordId: string, specKey: string) {
  const record = records.find((r) => r.id === recordId);
  const spec = record?.specs.find((s) => s.key === specKey);
  return spec?.recommendedSize;
}

describe('PLATFORM_PRESETS 与 data-platforms 一致性', () => {
  it('应至少含 1 个 knowledge 来源预设', () => {
    expect(PLATFORM_PRESETS.some((p) => p.source === 'knowledge')).toBe(true);
  });

  it('每个映射规格的尺寸应与知识仓 recommendedSize 逐字段相等', () => {
    for (const [sid, presetId] of Object.entries(MAPPING)) {
      const [recordId, specKey] = sid.split('/');
      const size = specSize(recordId!, specKey!);
      expect(size, `知识仓缺少尺寸: ${sid}`).toBeDefined();
      const preset = PLATFORM_PRESETS.find((p) => p.id === presetId);
      expect(preset, `预设缺失: ${presetId}`).toBeDefined();
      expect(preset!.source, `${presetId} 应标为 knowledge`).toBe('knowledge');
      expect(preset!.width, `${presetId}.width 漂移,请重跑 pnpm codegen`).toBe(size!.width);
      expect(preset!.height, `${presetId}.height 漂移,请重跑 pnpm codegen`).toBe(size!.height);
    }
  });

  it('所有 knowledge 预设的尺寸应能在知识仓中找到对应 recommendedSize', () => {
    const knowledgePresets = PLATFORM_PRESETS.filter((p) => p.source === 'knowledge');
    const knownSizes = new Set(
      Object.entries(MAPPING).map(([sid]) => {
        const [recordId, specKey] = sid.split('/');
        const s = specSize(recordId!, specKey!)!;
        return `${s.width}x${s.height}`;
      })
    );
    for (const p of knowledgePresets) {
      expect(
        knownSizes.has(`${p.width}x${p.height}`),
        `knowledge 预设 ${p.id}(${p.width}x${p.height}) 无对应知识仓尺寸`
      ).toBe(true);
    }
  });
});

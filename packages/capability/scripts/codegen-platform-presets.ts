/**
 * codegen-platform-presets.ts(C1)
 *
 * 生成 `packages/capability/src/presets/platform.generated.ts`(完整的
 * PLATFORM_PRESETS 数组,自包含,运行时零新增依赖)。
 *
 * 两个事实源:
 * 1. `@lokvis/data-platforms`(lokvis-knowledge 仓发布,Knowledge 存 Facts 铁律)——
 *    取 `recommendedSize` 作为 width/height 的唯一权威来源;
 * 2. `../src/presets/platform-manual.ts`——知识仓暂未收录的长尾平台手工数据
 *    (过渡态,`source: 'manual'`)。
 *
 * 合并规则:
 * - 知识仓带 `recommendedSize` 的规格,若在下表 MAPPING 中登记了对应手工预设 id,
 *   则取知识仓 width/height(事实优先),其余展示字段(platform/name/category/
 *   description/recommendedFormat/recommendedFit)沿用手工值以保持 id 与 UX 稳定;
 * - 带 `recommendedSize` 但未登记映射、也未列入 SKIP 的规格,自动派生新预设
 *   (`source: 'knowledge'`);
 * - 手工预设中已被映射的 id 从 manual 段剔除(避免重复),其余原样保留(`source: 'manual'`)。
 *
 * 用法(由根 `pnpm codegen` 调用):
 *   node packages/capability/scripts/codegen-platform-presets.ts
 *
 * 数据缺口(知识仓未收录的平台/尺寸)应在 lokvis-knowledge 仓补入带 `ref:` 来源的
 * 数据后由本脚本接管,而非在 open 侧手工覆盖。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANUAL_PLATFORM_PRESETS } from '../src/presets/platform-manual.ts';
import type {
  PlatformSizePreset,
  PlatformPresetCategory,
  PlatformRecommendedFormat,
} from '../src/presets/platform-types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'presets', 'platform.generated.ts');

// --- data-platforms 类型(仅取所需字段) ---

interface KnowledgeSize {
  width: number;
  height: number;
}

interface KnowledgeSpec {
  key: string;
  kind: string;
  recommendedSize?: KnowledgeSize;
  acceptedFormats?: string[];
  notes?: string;
}

interface KnowledgeRecord {
  id: string; // `platform:xxx`
  name: string;
  category: string;
  specs: KnowledgeSpec[];
}

interface KnowledgeBundle {
  version: string;
  records: KnowledgeRecord[];
}

// --- 合并配置 ---

/** 知识仓 category → 预设 category */
const CATEGORY_MAP: Record<string, PlatformPresetCategory> = {
  'social-media': 'social',
  'e-commerce': 'ecommerce',
  'video-platform': 'video',
  messaging: 'social',
  'web-standard': 'other',
  print: 'print',
};

/** 知识仓规格(`${record.id}/${spec.key}`)→ 既有手工预设 id(保持 id 稳定) */
const MAPPING: Record<string, string> = {
  'platform:amazon/product-image': 'amazon.product',
  'platform:amazon/brand-banner': 'amazon.header',
  'platform:app-icons/ios-app-icon': 'app.icon-ios',
  'platform:app-icons/android-xxxhdpi': 'app.icon-android',
  'platform:discord/avatar': 'discord.avatar',
  'platform:discord/server-banner': 'discord.banner',
  'platform:ebay/listing-image': 'ebay.listing',
  'platform:etsy/listing-image': 'etsy.listing',
  'platform:etsy/shop-banner': 'etsy.header',
  'platform:facebook/cover-photo': 'facebook.cover',
  'platform:facebook/profile-photo': 'facebook.profile',
  'platform:facebook/feed-image': 'facebook.post',
  'platform:favicon/favicon-ico': 'web.favicon',
  'platform:instagram/feed-portrait': 'instagram.portrait',
  'platform:instagram/story': 'instagram.story',
  'platform:linkedin/post-image': 'linkedin.post',
  'platform:linkedin/cover-photo': 'linkedin.cover',
  'platform:linkedin/profile-photo': 'linkedin.profile',
  'platform:linkedin/company-logo': 'linkedin.company-logo',
  'platform:pinterest/standard-pin': 'pinterest.pin',
  'platform:pinterest/square-pin': 'pinterest.square',
  'platform:print/a4-300dpi': 'print.a4-300dpi',
  'platform:print/a4-150dpi': 'print.a4-150dpi',
  'platform:print/a3-300dpi': 'print.a3-300dpi',
  'platform:print/business-card': 'print.business-card',
  'platform:print/photo-4x6': 'print.photo-4x6',
  'platform:reddit/post-image': 'reddit.post',
  'platform:reddit/community-banner': 'reddit.banner',
  'platform:shopify/product-image': 'shopify.product',
  'platform:snapchat/story-ad': 'snapchat.story',
  'platform:spotify/playlist-cover': 'spotify.cover',
  'platform:telegram/profile-photo': 'telegram.profile',
  'platform:tiktok/video-cover': 'tiktok.video',
  'platform:tiktok/profile-photo': 'tiktok.profile',
  'platform:twitch/profile-photo': 'twitch.profile',
  'platform:twitch/panel-banner': 'twitch.banner',
  'platform:web-standard/og-image': 'web.og-image',
  'platform:web-standard/web-banner': 'web.banner',
  'platform:web-standard/email-header': 'web.email-header',
  'platform:wechat/article-cover': 'wechat.article',
  'platform:whatsapp/status-image': 'whatsapp.status',
  'platform:whatsapp/profile-photo': 'whatsapp.profile',
  'platform:x-twitter/profile-photo': 'twitter.profile',
  'platform:x-twitter/header-photo': 'twitter.header',
  'platform:xiaohongshu/note-image': 'xiaohongshu.post',
  'platform:youtube/thumbnail': 'youtube.thumbnail',
};

/** 显式跳过的规格(附理由,避免误以为遗漏) */
const SKIP: Record<string, string> = {
  'platform:favicon/favicon-png':
    '与 favicon-ico 同为 32×32,已由 web.favicon 承载(PNG 容器变体不构成独立预设)',
};

/** 自动派生预设的展示名覆盖(缺省由 specKey 人性化生成) */
const NAME_OVERRIDE: Record<string, string> = {
  'platform:favicon/apple-touch-icon': 'Apple Touch Icon',
};

// --- 工具 ---

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function specId(recordId: string, specKey: string): string {
  return `${recordId}/${specKey}`;
}

/** acceptedFormats → 可表达的 recommendedFormat(取首个命中) */
function deriveFormat(formats?: string[]): PlatformRecommendedFormat | undefined {
  if (!formats) return undefined;
  for (const f of formats) {
    if (f === 'format:jpeg') return 'jpeg';
    if (f === 'format:png') return 'png';
    if (f === 'format:webp') return 'webp';
  }
  return undefined;
}

function humanize(key: string): string {
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// --- 合并 ---

function buildPresets(bundle: KnowledgeBundle): PlatformSizePreset[] {
  const manualById = new Map(MANUAL_PLATFORM_PRESETS.map((p) => [p.id, p]));
  const consumedManualIds = new Set<string>();
  const knowledgePresets: PlatformSizePreset[] = [];

  for (const record of bundle.records) {
    const category = CATEGORY_MAP[record.category];
    if (!category) {
      throw new Error(`未知知识仓 category: ${record.category}(${record.id})`);
    }
    for (const spec of record.specs) {
      if (!spec.recommendedSize) continue; // 无尺寸事实,不生成预设
      const sid = specId(record.id, spec.key);
      if (SKIP[sid]) continue;

      const { width, height } = spec.recommendedSize;
      const mappedId = MAPPING[sid];

      if (mappedId) {
        const manual = manualById.get(mappedId);
        if (!manual) {
          throw new Error(`映射目标手工预设不存在: ${sid} → ${mappedId}`);
        }
        consumedManualIds.add(mappedId);
        // 事实(尺寸)取知识仓,展示字段沿用手工值
        knowledgePresets.push({ ...manual, width, height, source: 'knowledge' });
      } else {
        const recordSlug = record.id.replace(/^platform:/, '');
        knowledgePresets.push({
          id: `${recordSlug}.${spec.key}`,
          platform: record.name,
          name: NAME_OVERRIDE[sid] ?? humanize(spec.key),
          width,
          height,
          category,
          description: spec.notes,
          recommendedFormat: deriveFormat(spec.acceptedFormats),
          recommendedFit: 'cover',
          source: 'knowledge',
        });
      }
    }
  }

  // 校验:所有映射目标都应被消费(防止 MAPPING 写了但知识仓无对应规格)
  for (const sid of Object.keys(MAPPING)) {
    const manualId = MAPPING[sid]!;
    if (!consumedManualIds.has(manualId)) {
      throw new Error(`映射登记但知识仓无对应带尺寸规格: ${sid} → ${manualId}`);
    }
  }

  const manualPresets: PlatformSizePreset[] = MANUAL_PLATFORM_PRESETS.filter(
    (p) => !consumedManualIds.has(p.id)
  ).map((p) => ({ ...p, source: 'manual' as const }));

  return [...knowledgePresets, ...manualPresets];
}

// --- 序列化 ---

function presetToTs(p: PlatformSizePreset, indent: string): string {
  const inner = indent + '  ';
  const lines: string[] = [];
  lines.push(`${indent}{`);
  lines.push(`${inner}id: '${escapeStr(p.id)}',`);
  lines.push(`${inner}platform: '${escapeStr(p.platform)}',`);
  lines.push(`${inner}name: '${escapeStr(p.name)}',`);
  lines.push(`${inner}width: ${p.width},`);
  lines.push(`${inner}height: ${p.height},`);
  lines.push(`${inner}category: '${p.category}',`);
  if (p.description !== undefined) lines.push(`${inner}description: '${escapeStr(p.description)}',`);
  if (p.recommendedFormat !== undefined)
    lines.push(`${inner}recommendedFormat: '${p.recommendedFormat}',`);
  if (p.recommendedFit !== undefined) lines.push(`${inner}recommendedFit: '${p.recommendedFit}',`);
  lines.push(`${inner}source: '${p.source ?? 'manual'}',`);
  lines.push(`${indent}},`);
  return lines.join('\n');
}

function generateFile(presets: PlatformSizePreset[], bundle: KnowledgeBundle): string {
  const knowledgeCount = presets.filter((p) => p.source === 'knowledge').length;
  const manualCount = presets.filter((p) => p.source === 'manual').length;
  const body = presets.map((p) => presetToTs(p, '  ')).join('\n');

  return `/**
 * AUTO-GENERATED BY packages/capability/scripts/codegen-platform-presets.ts — DO NOT EDIT.
 *
 * 事实源:
 * - @lokvis/data-platforms@${bundle.version}(lokvis-knowledge 仓)—— ${knowledgeCount} 个 knowledge 预设
 * - packages/capability/src/presets/platform-manual.ts —— ${manualCount} 个 manual 预设(待迁入知识仓)
 *
 * 重跑:pnpm codegen
 *
 * 尺寸(width/height)以知识仓为唯一权威;展示字段(platform/name/category/
 * recommendedFormat/recommendedFit)在映射预设上沿用手工值以保持 UX 稳定。
 * 数据缺口请向 lokvis-knowledge 仓补入带来源的数据,勿在此文件手工修改。
 */
import type { PlatformSizePreset } from './platform-types.js';

export const PLATFORM_PRESETS: PlatformSizePreset[] = [
${body}
];
`;
}

// --- 主流程 ---

async function main(): Promise<void> {
  const require = createRequire(import.meta.url);
  const jsonPath = require.resolve('@lokvis/data-platforms');
  const bundle = JSON.parse(await readFile(jsonPath, 'utf8')) as KnowledgeBundle;

  if (!Array.isArray(bundle.records) || bundle.records.length === 0) {
    throw new Error('data-platforms bundle 缺少 records');
  }

  const presets = buildPresets(bundle);

  // 不变量校验(与 platform-presets.test.ts 的验收标准对齐)
  const ids = presets.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error('预设 id 存在重复');
  for (const id of ids) {
    if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(id)) throw new Error(`预设 id 格式非法: ${id}`);
  }
  if (presets.length < 60) throw new Error(`预设总数 ${presets.length} < 60(验收下限)`);
  const platforms = new Set(presets.map((p) => p.platform));
  if (platforms.size < 20) throw new Error(`平台数 ${platforms.size} < 20(验收下限)`);
  for (const cat of ['social', 'ecommerce', 'video', 'print', 'other'] as const) {
    if (!presets.some((p) => p.category === cat)) throw new Error(`category "${cat}" 为空`);
  }

  await writeFile(OUT_PATH, generateFile(presets, bundle), 'utf8');
  const knowledgeCount = presets.filter((p) => p.source === 'knowledge').length;
  console.log(
    `[codegen] 已生成 platform.generated.ts:${presets.length} 个预设` +
      `(${knowledgeCount} knowledge + ${presets.length - knowledgeCount} manual),` +
      `${platforms.size} 个平台,data-platforms@${bundle.version}`
  );
}

main().catch((err) => {
  console.error('[codegen] platform-presets 失败:', err);
  process.exit(1);
});

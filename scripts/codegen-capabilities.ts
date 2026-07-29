/**
 * codegen-capabilities.ts
 *
 * 读取 packages/capability/manifests/*.manifest.json,生成两类文件:
 * 1. packages/schema/src/capability-names.generated.ts
 *    - BuiltinCapabilityName 联合类型(精确字面量,IDE 自动补全)
 *    - BUILTIN_CAPABILITY_NAMES 常量数组(运行时校验用)
 * 2. packages/capability/src/presets/{domain}.generated.ts
 *    - 各域的 {DOMAIN}_{ACTION} 常量 + {DOMAIN}_CAPABILITIES 数组
 *
 * 设计原则(见 docs/adr/013-capability-manifest.md):
 * - manifest 是唯一信息源,生成代码与手写版本逐字段对应
 * - 不生成 CapabilityImplementation / definePlugin(实现仍由 plugin 手写)
 * - 能力名单一来源:BuiltinCapabilityName 联合类型 + BUILTIN_CAPABILITY_NAMES
 *   常量数组(手写的 CAPABILITY_NAMES 常量对象已删除,曾长期漂移)
 * - 生成文件加 // AUTO-GENERATED 头防止误编辑
 *
 * 用法:node scripts/codegen-capabilities.ts
 *
 * 输出格式约定:
 * - param 字段顺序:name / type / required / default / min / max / values / items / description
 *   (与手写 presets/*.ts 一致)
 * - 单行 param 在 100 字符内时用单行,否则多行(Prettier 风格)
 * - Capability 字段顺序:name / description / inputTypes / outputTypes / params /
 *   performance / batchable / mcpExposure / mcpToolName
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MANIFESTS_DIR = join(ROOT, 'packages/capability/manifests');
const SCHEMA_OUT = join(ROOT, 'packages/schema/src/capability-names.generated.ts');
const CAPABILITY_PRESETS_DIR = join(ROOT, 'packages/capability/src/presets');

const LINE_BUDGET = 100;

interface ManifestParam {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  values?: string[];
  items?: string;
}

interface ManifestCapability {
  action: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  params: ManifestParam[];
  performance: string;
  batchable?: boolean;
  mcpExposure?: string;
  mcpToolName?: string;
}

interface Manifest {
  $schema?: string;
  domain: string;
  capabilities: ManifestCapability[];
}

interface LoadedManifest {
  filename: string;
  manifest: Manifest;
}

// --- 字符串与命名工具 ---

/** 转义单引号字符串内容 */
function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** 把任意 JSON 值序列化为 TS 字面量(字符串用单引号) */
function tsValue(value: unknown): string {
  if (typeof value === 'string') return `'${escapeStr(value)}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map(tsValue).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{ ${entries.map(([k, v]) => `${k}: ${tsValue(v)}`).join(', ')} }`;
  }
  return String(value);
}

/** action → UPPER_SNAKE_CASE 后缀(如 `generate-workflow` → `GENERATE_WORKFLOW`) */
function actionToSuffix(action: string): string {
  return action.replace(/[-.]/g, '_').toUpperCase();
}

/** domain → UPPER_SNAKE_CASE 前缀(如 `image` → `IMAGE`, `developer` → `DEV`) */
function domainToPrefix(domain: string): string {
  // developer → DEV 缩写(其他 domain 直接大写)
  if (domain === 'developer') return 'DEV';
  return domain.toUpperCase().replace(/-/g, '_');
}

/** 缩进(2 空格 × level) */
function ind(level: number): string {
  return '  '.repeat(level);
}

// --- param 序列化 ---

/** 生成 param 的单行表示(不含外层缩进) */
function paramSingleLine(param: ManifestParam): string {
  const parts: string[] = [];
  parts.push(`name: '${escapeStr(param.name)}'`);
  parts.push(`type: '${escapeStr(param.type)}'`);
  if (param.required !== undefined) parts.push(`required: ${param.required}`);
  if (param.default !== undefined) parts.push(`default: ${tsValue(param.default)}`);
  if (param.min !== undefined) parts.push(`min: ${param.min}`);
  if (param.max !== undefined) parts.push(`max: ${param.max}`);
  if (param.values !== undefined) {
    parts.push(`values: [${param.values.map(v => `'${escapeStr(v)}'`).join(', ')}]`);
  }
  if (param.items !== undefined) parts.push(`items: '${escapeStr(param.items)}'`);
  if (param.description !== undefined) parts.push(`description: '${escapeStr(param.description)}'`);
  return `{ ${parts.join(', ')} }`;
}

/** 生成 param 的多行表示(每字段一行,外层缩进为 baseIndent) */
function paramMultiLine(param: ManifestParam, baseIndent: number): string {
  const inner = ind(baseIndent + 1);
  const parts: string[] = [];
  parts.push(`name: '${escapeStr(param.name)}'`);
  parts.push(`type: '${escapeStr(param.type)}'`);
  if (param.required !== undefined) parts.push(`required: ${param.required}`);
  if (param.default !== undefined) parts.push(`default: ${tsValue(param.default)}`);
  if (param.min !== undefined) parts.push(`min: ${param.min}`);
  if (param.max !== undefined) parts.push(`max: ${param.max}`);
  if (param.values !== undefined) {
    parts.push(`values: [${param.values.map(v => `'${escapeStr(v)}'`).join(', ')}]`);
  }
  if (param.items !== undefined) parts.push(`items: '${escapeStr(param.items)}'`);
  if (param.description !== undefined) parts.push(`description: '${escapeStr(param.description)}'`);
  return `{\n${inner}${parts.join(`,\n${inner}`)},\n${ind(baseIndent)}}`;
}

/** 生成 param 的 TS 表示,单行优先,超长则多行 */
function paramToTs(param: ManifestParam, baseIndent: number): string {
  const single = paramSingleLine(param);
  // 含缩进 + 末尾逗号的总宽度
  if (ind(baseIndent).length + single.length + 1 <= LINE_BUDGET) {
    return single;
  }
  return paramMultiLine(param, baseIndent);
}

// --- Capability 序列化 ---

/** 生成单个 Capability 常量的 TS 代码 */
function capabilityToTs(manifest: Manifest, cap: ManifestCapability): string {
  const prefix = domainToPrefix(manifest.domain);
  const suffix = actionToSuffix(cap.action);
  const constName = `${prefix}_${suffix}`;
  const fullName = `${manifest.domain}.${cap.action}`;

  const lines: string[] = [];
  lines.push(`export const ${constName}: Capability = {`);
  lines.push(`${ind(1)}name: '${fullName}',`);
  lines.push(`${ind(1)}description: '${escapeStr(cap.description)}',`);
  lines.push(`${ind(1)}inputTypes: [${cap.inputTypes.map(t => `'${t}'`).join(', ')}],`);
  lines.push(`${ind(1)}outputTypes: [${cap.outputTypes.map(t => `'${t}'`).join(', ')}],`);

  if (cap.params.length === 0) {
    lines.push(`${ind(1)}params: [],`);
  } else {
    lines.push(`${ind(1)}params: [`);
    cap.params.forEach(p => {
      lines.push(`${ind(2)}${paramToTs(p, 2)},`);
    });
    lines.push(`${ind(1)}],`);
  }

  lines.push(`${ind(1)}performance: '${cap.performance}',`);
  if (cap.batchable !== undefined) lines.push(`${ind(1)}batchable: ${cap.batchable},`);
  if (cap.mcpExposure !== undefined) lines.push(`${ind(1)}mcpExposure: '${cap.mcpExposure}',`);
  if (cap.mcpToolName !== undefined) lines.push(`${ind(1)}mcpToolName: '${escapeStr(cap.mcpToolName)}',`);
  lines.push(`};`);

  return lines.join('\n');
}

/** 生成单个域的 .generated.ts 文件内容 */
function generateDomainFile(loaded: LoadedManifest): string {
  const { filename, manifest } = loaded;
  const prefix = domainToPrefix(manifest.domain);
  const constNames = manifest.capabilities.map(cap => {
    const suffix = actionToSuffix(cap.action);
    return `${prefix}_${suffix}`;
  });

  const capBlocks = manifest.capabilities.map(cap => capabilityToTs(manifest, cap));

  const capArrayName = `${prefix}_CAPABILITIES`;
  const arrayBody = constNames.length > 0
    ? constNames.map(n => `${ind(1)}${n},`).join('\n')
    : '';

  return `/**
 * AUTO-GENERATED BY scripts/codegen-capabilities.ts — DO NOT EDIT.
 *
 * 来源:packages/capability/manifests/${filename}
 * 重跑:pnpm codegen
 */
import type { Capability } from '@lokvis/schema';

${capBlocks.join('\n\n')}

/** 所有内置 ${manifest.domain} 能力预设(由 codegen 从 manifest 生成) */
export const ${capArrayName}: Capability[] = [
${arrayBody}
];
`;
}

// --- capability-names.generated.ts 序列化 ---

/** 生成 schema/src/capability-names.generated.ts 内容 */
function generateNamesFile(loaded: Manifest[]): string {
  // 按 domain 顺序 + manifest 中 capabilities 顺序收集
  const names: string[] = [];
  const domains: string[] = [];
  for (const m of loaded) {
    domains.push(m.domain);
    for (const cap of m.capabilities) {
      names.push(`${m.domain}.${cap.action}`);
    }
  }

  const unionBody = names.map(n => `  | '${n}'`).join('\n');
  const arrBody = names.map(n => `${ind(1)}'${n}',`).join('\n');

  const manifestList = loaded.map(m => `packages/capability/manifests/${m.domain}.manifest.json`).join(', ');

  return `/**
 * AUTO-GENERATED BY scripts/codegen-capabilities.ts — DO NOT EDIT.
 *
 * 来源:${manifestList}
 * 重跑:pnpm codegen
 *
 * 此文件提供精确字面量联合类型 BuiltinCapabilityName,
 * 用于 IDE 自动补全与编译期拼写检查。
 *
 * 注意:
 * - \`CapabilityName\`(见 capability.ts)仍是 \`string\` 别名,
 *   接受任意能力名(含第三方 plugin 注册的自定义能力)
 * - \`BuiltinCapabilityName\` 是已知内置能力的字面量子集,
 *   可作为 \`CapabilityName\` 的精确化类型
 */
export type BuiltinCapabilityName =
${unionBody};

/** 全部内置能力名常量数组(运行时校验 / 枚举用) */
export const BUILTIN_CAPABILITY_NAMES: readonly BuiltinCapabilityName[] = [
${arrBody}
];
`;
}

// --- 主流程 ---

async function loadManifests(): Promise<LoadedManifest[]> {
  const entries = await readdir(MANIFESTS_DIR, { withFileTypes: true });
  const manifestFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.manifest.json'))
    .map(e => e.name)
    .sort();

  const loaded: LoadedManifest[] = [];
  for (const filename of manifestFiles) {
    const path = join(MANIFESTS_DIR, filename);
    const content = await readFile(path, 'utf8');
    const manifest = JSON.parse(content) as Manifest;
    loaded.push({ filename, manifest });
  }
  return loaded;
}

async function main(): Promise<void> {
  const loaded = await loadManifests();

  if (loaded.length === 0) {
    console.error('[codegen] 未找到 manifest 文件 (*.manifest.json)');
    process.exit(1);
  }

  // 1. 生成 schema/src/capability-names.generated.ts
  const namesContent = generateNamesFile(loaded.map(l => l.manifest));
  await mkdir(dirname(SCHEMA_OUT), { recursive: true });
  await writeFile(SCHEMA_OUT, namesContent, 'utf8');
  console.log(`[codegen] 已生成 ${SCHEMA_OUT.replace(ROOT + '/', '')}`);

  // 2. 生成 capability/src/presets/{domain}.generated.ts
  await mkdir(CAPABILITY_PRESETS_DIR, { recursive: true });
  for (const l of loaded) {
    const outPath = join(CAPABILITY_PRESETS_DIR, `${l.manifest.domain}.generated.ts`);
    const content = generateDomainFile(l);
    await writeFile(outPath, content, 'utf8');
    console.log(`[codegen] 已生成 ${outPath.replace(ROOT + '/', '')}`);
  }

  // 汇总
  const totalCaps = loaded.reduce((sum, l) => sum + l.manifest.capabilities.length, 0);
  console.log(`[codegen] 完成:${loaded.length} 个 manifest,${totalCaps} 个能力`);
}

main().catch(err => {
  console.error('[codegen] 失败:', err);
  process.exit(1);
});

/**
 * codegen-mcp-tools.ts（G4 — MCP 工具描述数据化）
 *
 * 从 capability manifests + @lokvis/data-formats 生成 MCP 工具元数据。
 * 镜像 C1（codegen-platform-presets.ts）模式：
 * - 数据源：packages/capability/manifests/*.manifest.json + @lokvis/data-formats（devDep）
 * - 产物：packages/mcp-server/src/tools/tool-metadata.generated.ts（入库，运行时零新增依赖）
 * - 手工覆盖位：packages/mcp-server/src/tools/manual-overrides.ts（MCP 特有 inputSchema / 描述增强）
 *
 * 用法：node scripts/codegen-mcp-tools.ts
 * 重跑：pnpm codegen
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MANIFESTS_DIR = join(ROOT, 'packages/capability/manifests');
const OUT_FILE = join(ROOT, 'packages/mcp-server/src/tools/tool-metadata.generated.ts');

const SKIP_DOMAINS = new Set(['developer', 'archive', 'asset']);

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
  domain: string;
  capabilities: ManifestCapability[];
}

interface LoadedManifest {
  filename: string;
  manifest: Manifest;
}

interface FormatRecord {
  id: string;
  domain: string;
  name: string;
  extensions: string[];
  features?: Record<string, boolean>;
}

interface FormatsData {
  records: FormatRecord[];
}

// --- 工具函数 ---

function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function actionToToolName(domain: string, action: string, mcpToolName?: string): string {
  return mcpToolName ?? `lokvis_${domain}_${action.replace(/[-.]/g, '_')}`;
}

function capabilityName(domain: string, action: string): string {
  return `${domain}.${action}`;
}

// --- 格式约束 ---

function formatConstraints(domain: string, records: FormatRecord[]): string | null {
  const domainRecords = records
    .filter(r => r.domain === domain)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (domainRecords.length === 0) return null;

  const featureSet = new Set<string>();
  for (const r of domainRecords) {
    for (const [k, v] of Object.entries(r.features ?? {})) {
      if (v === true) featureSet.add(k);
    }
  }
  const features = [...featureSet].sort().join(', ');
  const names = domainRecords.map(r => r.name).join(', ');
  return `Supported ${domain} formats: ${names}. Format features: ${features}.`;
}

// --- 主流程 ---

async function loadManifests(): Promise<LoadedManifest[]> {
  const entries = await readdir(MANIFESTS_DIR, { withFileTypes: true });
  const files = entries
    .filter(e => e.isFile() && e.name.endsWith('.manifest.json'))
    .map(e => e.name)
    .sort();

  const loaded: LoadedManifest[] = [];
  for (const filename of files) {
    const content = await readFile(join(MANIFESTS_DIR, filename), 'utf8');
    loaded.push({ filename, manifest: JSON.parse(content) as Manifest });
  }
  return loaded;
}

function loadFormats(): FormatRecord[] {
  try {
    const require = createRequire(resolve(ROOT, 'packages/mcp-server/package.json'));
    const data = require('@lokvis/data-formats') as FormatsData;
    return data.records ?? [];
  } catch (err) {
    if (process.env.CI) {
      throw new Error(`[codegen-mcp] @lokvis/data-formats 未安装（CI 不允许静默降级）: ${err}`);
    }
    console.warn('[codegen-mcp] @lokvis/data-formats 未安装，跳过格式约束');
    return [];
  }
}

function generateTools(loaded: LoadedManifest[], records: FormatRecord[]): Array<{
  toolName: string;
  capability: string;
  description: string;
}> {
  const tools: Array<{ toolName: string; capability: string; description: string }> = [];

  for (const { manifest } of loaded) {
    if (SKIP_DOMAINS.has(manifest.domain)) continue;

    for (const cap of manifest.capabilities) {
      if (cap.mcpExposure === 'private') continue;

      const toolName = actionToToolName(manifest.domain, cap.action, cap.mcpToolName);
      const base = cap.description;
      const constraint = formatConstraints(manifest.domain, records);
      const description = constraint ? `${base} ${constraint}` : base;

      tools.push({
        toolName,
        capability: capabilityName(manifest.domain, cap.action),
        description,
      });
    }
  }

  return tools;
}

function generateFileContent(
  tools: Array<{ toolName: string; capability: string; description: string }>,
  manifestCount: number,
  formatCount: number,
): string {
  const entries = tools.map(t => {
    const lines: string[] = [];
    lines.push(`  {`);
    lines.push(`    name: '${escapeStr(t.toolName)}',`);
    lines.push(`    capability: '${escapeStr(t.capability)}',`);
    lines.push(`    description: '${escapeStr(t.description)}',`);
    lines.push(`  },`);
    return lines.join('\n');
  });

  return `/**
 * AUTO-GENERATED BY scripts/codegen-mcp-tools.ts — DO NOT EDIT.
 *
 * 来源：packages/capability/manifests/*.manifest.json (${manifestCount} manifests)
 *       + @lokvis/data-formats (${formatCount} format records)
 * 重跑：pnpm codegen
 *
 * MCP 工具元数据（描述 + 能力名映射）。
 * 手工覆盖位：tools/manual-overrides.ts（MCP 特有 inputSchema / 描述增强）。
 */

export interface GeneratedToolMeta {
  /** MCP tool 名（如 lokvis_image_resize） */
  name: string;
  /** 对应能力名（如 image.resize） */
  capability: string;
  /** 工具描述（manifest 描述 + 格式约束） */
  description: string;
}

export const GENERATED_TOOL_META: GeneratedToolMeta[] = [
${entries.join('\n')}
];
`;
}

async function main(): Promise<void> {
  const loaded = await loadManifests();
  const records = loadFormats();
  const tools = generateTools(loaded, records);

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, generateFileContent(tools, loaded.length, records.length), 'utf8');

  const domains = [...new Set(tools.map(t => t.capability.split('.')[0]))].sort();
  console.log(
    `[codegen-mcp] 已生成 ${OUT_FILE.replace(ROOT + '/', '')} ` +
    `(${tools.length} tools, domains: ${domains.join(', ')}, ` +
    `formats: ${records.length})`
  );
}

main().catch(err => {
  console.error('[codegen-mcp] 失败:', err);
  process.exit(1);
});

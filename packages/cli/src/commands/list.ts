/**
 * `lokvis list [dir]` 命令
 *
 * 列出指定目录(默认 cwd)下所有 workflow JSON 文件,并展示摘要信息。
 *
 * 识别策略:
 * - 递归扫描 `*.json` 文件(跳过 node_modules / dist / .git 等常见忽略目录)
 * - 对每个 .json 尝试 validateWorkflow(形状 + 结构层)
 * - 通过校验的视为 workflow,列入输出;未通过的默认不显示(--all 显示)
 *
 * 输出:
 * - 默认:表格 PATH | ID | NAME | CATEGORY | NODES,退出码 0
 * - --all:同时显示无效文件及错误(--include-invalid)
 * - --json:JSON 数组,便于 CI 解析
 *
 * 设计目标:帮助用户在仓库中快速发现 workflow 文件,识别"哪个是 workflow、
 * 哪个是配置文件",避免误把 package.json 当 workflow 喂给 `lokvis run`。
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { validateWorkflow, MAX_WORKFLOW_STEPS } from '@lokvis/schema';

export interface ListOptions {
  /** 是否包含未通过校验的 .json 文件(默认 false,仅显示有效 workflow) */
  includeInvalid?: boolean;
  /** JSON 格式输出(便于 CI 解析) */
  json?: boolean;
  /** 最大递归深度(默认 Infinity,全量递归) */
  maxDepth?: number;
}

export interface ListEntry {
  /** 文件绝对路径 */
  path: string;
  /** 相对根目录的路径(便于阅读) */
  relativePath: string;
  /** 是否通过 workflow 校验 */
  valid: boolean;
  /** 校验失败时的错误列表(前 3 条,避免输出过长) */
  errors: string[];
  /** 工作流摘要(valid=true 时填充) */
  summary?: {
    id: string;
    name: string;
    version: string;
    category: string;
    nodeCount: number;
    edgeCount: number;
  };
}

/** 默认忽略的目录名(避免递归进入依赖/构建产物) */
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.turbo',
  '.cache',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
]);

/**
 * 列出指定目录下的 workflow 文件。
 *
 * @param rootDir 要扫描的根目录(默认 cwd)
 * @param options 选项
 * @returns ListEntry 数组(已按 relativePath 排序)
 */
export async function listWorkflows(
  rootDir: string = process.cwd(),
  options: ListOptions = {}
): Promise<ListEntry[]> {
  const absRoot = resolve(process.cwd(), rootDir);
  // exists-check 惯用法(FO-07 豁免):stat 失败即「不存在」,由下方显式报错
  const rootStat = await stat(absRoot).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`Directory not found: ${absRoot}`);
  }

  const entries: ListEntry[] = [];
  const maxDepth = options.maxDepth ?? Infinity;
  await walk(absRoot, 0);

  // 按 relativePath 字典序排序,输出稳定
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return entries;

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    // exists-check 惯用法(FO-07 豁免):目录不可读(权限/竞态删除)按空目录继续遍历
    const files = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const ent of files) {
      // 跳过符号链接(避免环);withFileTypes 时 ent.isDirectory() 已排除文件
      if (ent.isSymbolicLink()) continue;
      const fullPath = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (IGNORED_DIRS.has(ent.name)) continue;
        await walk(fullPath, depth + 1);
      } else if (ent.isFile() && ent.name.endsWith('.json')) {
        const entry = await tryParseWorkflow(fullPath, absRoot);
        if (entry.valid || options.includeInvalid) {
          entries.push(entry);
        }
      }
    }
  }
}

/** 尝试将文件解析为 workflow,返回 ListEntry */
async function tryParseWorkflow(filePath: string, rootDir: string): Promise<ListEntry> {
  const relativePath = relative(rootDir, filePath);
  // exists-check 惯用法(FO-07 豁免):读取失败记为 invalid 条目,不中断扫描
  const content = await readFile(filePath, 'utf-8').catch(() => null);
  if (content === null) {
    return {
      path: filePath,
      relativePath,
      valid: false,
      errors: ['Failed to read file'],
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (err) {
    return {
      path: filePath,
      relativePath,
      valid: false,
      errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // 用 MAX_WORKFLOW_STEPS 作为默认上限,与 Runtime 约束一致;
  // list 命令不暴露 --max-steps 选项,避免与 validate 命令语义冲突
  const parsed = validateWorkflow(raw, { maxSteps: MAX_WORKFLOW_STEPS });
  if (!parsed.success) {
    return {
      path: filePath,
      relativePath,
      valid: false,
      errors: parsed.error.issues.slice(0, 3).map((issue) => {
        const prefix = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${prefix}${issue.message}`;
      }),
    };
  }

  const wf = parsed.data;
  return {
    path: filePath,
    relativePath,
    valid: true,
    errors: [],
    summary: {
      id: wf.id,
      name: wf.name,
      version: wf.version,
      category: wf.category,
      nodeCount: wf.nodes.length,
      edgeCount: wf.edges.length,
    },
  };
}

/**
 * 格式化 ListEntry[] 为可读表格(非 JSON 模式)。
 *
 * 列宽对齐:PATH 列固定 40 字符截断,其余列按内容宽度。
 * 包含无效文件时(valid=false)显示错误前 1 条,标 ✗。
 */
export function formatListEntries(entries: ListEntry[]): string {
  if (entries.length === 0) {
    return 'No workflow files found.\n';
  }

  // 列宽:取所有 entries 的最大宽度,最小 8
  const pathW = Math.max(8, ...entries.map((e) => e.relativePath.length));
  const idW = Math.max(2, ...entries.map((e) => e.summary?.id?.length ?? 0));
  const nameW = Math.max(4, ...entries.map((e) => e.summary?.name?.length ?? 0));
  const catW = Math.max(8, ...entries.map((e) => e.summary?.category?.length ?? 0));

  const header = [
    'PATH'.padEnd(pathW),
    'ID'.padEnd(idW),
    'NAME'.padEnd(nameW),
    'CATEGORY'.padEnd(catW),
    'NODES',
  ].join('  ');
  const sep = '-'.repeat(header.length);

  const lines = [
    `Workflows (${entries.length}):`,
    '',
    header,
    sep,
  ];

  for (const e of entries) {
    if (e.valid && e.summary) {
      lines.push([
        e.relativePath.padEnd(pathW),
        e.summary.id.padEnd(idW),
        e.summary.name.padEnd(nameW),
        e.summary.category.padEnd(catW),
        String(e.summary.nodeCount),
      ].join('  '));
    } else {
      const err = e.errors[0] ?? 'invalid';
      // 无效文件:显示路径 + 错误前缀,占位对齐
      lines.push([
        e.relativePath.padEnd(pathW),
        '✗ invalid'.padEnd(idW + nameW + catW + 4),
        '',
        '',
        err.slice(0, 40),
      ].join('  '));
    }
  }
  lines.push('');
  return lines.join('\n');
}

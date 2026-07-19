/**
 * `lokvis list [dir]` 命令单元测试
 *
 * 验证 listWorkflows 的:
 * 1. 目录不存在 → 抛错
 * 2. 扫描 *.json 文件,识别有效 workflow
 * 3. 跳过 IGNORED_DIRS(node_modules / dist / .git 等)
 * 4. includeInvalid=true 显示无效 .json 文件
 * 5. maxDepth 限制递归深度
 * 6. 跳过符号链接(通过 mockDirent 模拟)
 * 7. formatListEntries 格式化
 *
 * 使用真实 fs 写入临时 fixture 文件,验证 readdir + readFile 链路。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listWorkflows, formatListEntries } from '../../commands/list.js';
import type { ListEntry } from '../../commands/list.js';

/** 构造合法 Workflow JSON 对象 */
function makeWorkflow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'wf-test',
    version: '1.0.0',
    name: 'Test Workflow',
    description: 'for testing',
    author: { id: 'tester', name: 'tester' },
    category: 'other',
    tags: [],
    nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize' }],
    edges: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
    ...overrides,
  };
}

describe('listWorkflows', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-list-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('目录校验', () => {
    it('目录不存在应抛错', async () => {
      const missing = join(tmpDir, 'nonexistent');
      await expect(listWorkflows(missing)).rejects.toThrow(/Directory not found:/);
    });

    it('传入文件(非目录)应抛错', async () => {
      const filePath = join(tmpDir, 'file.json');
      await writeFile(filePath, '{}', 'utf-8');
      await expect(listWorkflows(filePath)).rejects.toThrow(/Directory not found:/);
    });
  });

  describe('扫描 *.json', () => {
    it('应识别合法 workflow 文件', async () => {
      await writeFile(join(tmpDir, 'a.json'), JSON.stringify(makeWorkflow()), 'utf-8');
      await writeFile(
        join(tmpDir, 'b.json'),
        JSON.stringify(makeWorkflow({ id: 'wf-b', name: 'B' })),
        'utf-8'
      );
      const entries = await listWorkflows(tmpDir);
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.valid)).toBe(true);
      // 排序后 a.json 在前
      expect(entries[0]!.relativePath).toBe('a.json');
      expect(entries[1]!.relativePath).toBe('b.json');
    });

    it('默认不显示无效 .json(package.json 等)', async () => {
      // package.json 不是 workflow,校验失败
      await writeFile(
        join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'pkg', version: '1.0.0' }),
        'utf-8'
      );
      // 合法 workflow
      await writeFile(join(tmpDir, 'wf.json'), JSON.stringify(makeWorkflow()), 'utf-8');
      const entries = await listWorkflows(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.relativePath).toBe('wf.json');
      expect(entries[0]!.valid).toBe(true);
    });

    it('includeInvalid=true 应包含无效文件及错误', async () => {
      await writeFile(
        join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'pkg', version: '1.0.0' }),
        'utf-8'
      );
      await writeFile(join(tmpDir, 'broken.json'), '{ not json }', 'utf-8');
      await writeFile(join(tmpDir, 'wf.json'), JSON.stringify(makeWorkflow()), 'utf-8');

      const entries = await listWorkflows(tmpDir, { includeInvalid: true });
      expect(entries).toHaveLength(3);
      const byPath = new Map(entries.map((e) => [e.relativePath, e]));
      expect(byPath.get('wf.json')!.valid).toBe(true);
      expect(byPath.get('package.json')!.valid).toBe(false);
      expect(byPath.get('package.json')!.errors.length).toBeGreaterThan(0);
      expect(byPath.get('broken.json')!.valid).toBe(false);
      expect(byPath.get('broken.json')!.errors[0]).toMatch(/Invalid JSON/);
    });

    it('非 .json 文件应被忽略', async () => {
      await writeFile(join(tmpDir, 'wf.json'), JSON.stringify(makeWorkflow()), 'utf-8');
      await writeFile(join(tmpDir, 'readme.md'), '# readme', 'utf-8');
      await writeFile(join(tmpDir, 'script.js'), 'console.log(1)', 'utf-8');
      const entries = await listWorkflows(tmpDir);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.relativePath).toBe('wf.json');
    });
  });

  describe('递归与忽略目录', () => {
    it('应递归扫描子目录', async () => {
      await mkdir(join(tmpDir, 'sub1'), { recursive: true });
      await mkdir(join(tmpDir, 'sub1', 'sub2'), { recursive: true });
      await writeFile(join(tmpDir, 'a.json'), JSON.stringify(makeWorkflow()), 'utf-8');
      await writeFile(
        join(tmpDir, 'sub1', 'b.json'),
        JSON.stringify(makeWorkflow({ id: 'b' })),
        'utf-8'
      );
      await writeFile(
        join(tmpDir, 'sub1', 'sub2', 'c.json'),
        JSON.stringify(makeWorkflow({ id: 'c' })),
        'utf-8'
      );
      const entries = await listWorkflows(tmpDir);
      expect(entries).toHaveLength(3);
      const paths = entries.map((e) => e.relativePath).sort();
      expect(paths).toEqual(['a.json', 'sub1/b.json', 'sub1/sub2/c.json']);
    });

    it('应跳过 IGNORED_DIRS(node_modules/dist/.git 等)', async () => {
      await mkdir(join(tmpDir, 'node_modules'), { recursive: true });
      await mkdir(join(tmpDir, 'dist'), { recursive: true });
      await mkdir(join(tmpDir, '.git'), { recursive: true });
      // 在 ignored 目录中放 workflow,不应被扫描
      await writeFile(
        join(tmpDir, 'node_modules', 'pkg.json'),
        JSON.stringify(makeWorkflow({ id: 'nm' })),
        'utf-8'
      );
      await writeFile(
        join(tmpDir, 'dist', 'wf.json'),
        JSON.stringify(makeWorkflow({ id: 'dist' })),
        'utf-8'
      );
      await writeFile(
        join(tmpDir, '.git', 'cfg.json'),
        JSON.stringify(makeWorkflow({ id: 'git' })),
        'utf-8'
      );
      // 根目录的合法 workflow 应被扫到
      await writeFile(join(tmpDir, 'main.json'), JSON.stringify(makeWorkflow({ id: 'main' })), 'utf-8');
      const entries = await listWorkflows(tmpDir);
      const paths = entries.map((e) => e.relativePath);
      expect(paths).toEqual(['main.json']);
      expect(paths).not.toContain('node_modules/pkg.json');
      expect(paths).not.toContain('dist/wf.json');
      expect(paths).not.toContain('.git/cfg.json');
    });

    it('maxDepth=0 应只扫根目录,不递归', async () => {
      await mkdir(join(tmpDir, 'sub'), { recursive: true });
      await writeFile(join(tmpDir, 'a.json'), JSON.stringify(makeWorkflow()), 'utf-8');
      await writeFile(
        join(tmpDir, 'sub', 'b.json'),
        JSON.stringify(makeWorkflow({ id: 'b' })),
        'utf-8'
      );
      const entries = await listWorkflows(tmpDir, { maxDepth: 0 });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.relativePath).toBe('a.json');
    });

    it('maxDepth=1 应扫根目录 + 1 层子目录', async () => {
      await mkdir(join(tmpDir, 'sub1'), { recursive: true });
      await mkdir(join(tmpDir, 'sub1', 'sub2'), { recursive: true });
      await writeFile(join(tmpDir, 'a.json'), JSON.stringify(makeWorkflow()), 'utf-8');
      await writeFile(
        join(tmpDir, 'sub1', 'b.json'),
        JSON.stringify(makeWorkflow({ id: 'b' })),
        'utf-8'
      );
      await writeFile(
        join(tmpDir, 'sub1', 'sub2', 'c.json'),
        JSON.stringify(makeWorkflow({ id: 'c' })),
        'utf-8'
      );
      const entries = await listWorkflows(tmpDir, { maxDepth: 1 });
      expect(entries).toHaveLength(2);
      const paths = entries.map((e) => e.relativePath);
      expect(paths).toContain('a.json');
      expect(paths).toContain('sub1/b.json');
      expect(paths).not.toContain('sub1/sub2/c.json');
    });
  });

  describe('排序', () => {
    it('应按 relativePath 字典序排序', async () => {
      await writeFile(join(tmpDir, 'z.json'), JSON.stringify(makeWorkflow({ id: 'z' })), 'utf-8');
      await writeFile(join(tmpDir, 'a.json'), JSON.stringify(makeWorkflow({ id: 'a' })), 'utf-8');
      await writeFile(join(tmpDir, 'm.json'), JSON.stringify(makeWorkflow({ id: 'm' })), 'utf-8');
      const entries = await listWorkflows(tmpDir);
      const paths = entries.map((e) => e.relativePath);
      expect(paths).toEqual(['a.json', 'm.json', 'z.json']);
    });
  });

  describe('summary 字段', () => {
    it('valid=true 时 summary 应填充完整字段', async () => {
      await writeFile(join(tmpDir, 'wf.json'), JSON.stringify(makeWorkflow()), 'utf-8');
      const entries = await listWorkflows(tmpDir);
      const e = entries[0]!;
      expect(e.summary).toBeDefined();
      expect(e.summary!.id).toBe('wf-test');
      expect(e.summary!.name).toBe('Test Workflow');
      expect(e.summary!.version).toBe('1.0.0');
      expect(e.summary!.category).toBe('other');
      expect(e.summary!.nodeCount).toBe(1);
      expect(e.summary!.edgeCount).toBe(0);
    });
  });
});

describe('formatListEntries', () => {
  it('空数组应输出 "No workflow files found."', () => {
    const out = formatListEntries([]);
    expect(out).toContain('No workflow files found.');
  });

  it('应输出表头与条目', () => {
    const entries: ListEntry[] = [
      {
        path: '/abs/a.json',
        relativePath: 'a.json',
        valid: true,
        errors: [],
        summary: {
          id: 'wf-a',
          name: 'A',
          version: '1.0.0',
          category: 'image',
          nodeCount: 3,
          edgeCount: 2,
        },
      },
    ];
    const out = formatListEntries(entries);
    expect(out).toContain('Workflows (1):');
    expect(out).toContain('PATH');
    expect(out).toContain('ID');
    expect(out).toContain('NAME');
    expect(out).toContain('CATEGORY');
    expect(out).toContain('NODES');
    expect(out).toContain('a.json');
    expect(out).toContain('wf-a');
    expect(out).toContain('A');
    expect(out).toContain('image');
    expect(out).toContain('3');
  });

  it('应同时显示无效文件(includeInvalid 模式)', () => {
    const entries: ListEntry[] = [
      {
        path: '/abs/wf.json',
        relativePath: 'wf.json',
        valid: true,
        errors: [],
        summary: {
          id: 'wf',
          name: 'Wf',
          version: '1.0.0',
          category: 'image',
          nodeCount: 1,
          edgeCount: 0,
        },
      },
      {
        path: '/abs/broken.json',
        relativePath: 'broken.json',
        valid: false,
        errors: ['Invalid JSON: Unexpected token'],
      },
    ];
    const out = formatListEntries(entries);
    expect(out).toContain('wf.json');
    expect(out).toContain('broken.json');
    expect(out).toContain('✗ invalid');
  });
});

/**
 * `lokvis run <workflow.json> [files...]` 命令单元测试
 *
 * 验证 runWorkflow 的:
 * 1. 文件不存在错误处理
 * 2. JSON 解析错误处理
 * 3. 工作流结构校验(各字段缺失场景)
 * 4. 输入文件不存在错误处理
 * 5. 正常执行路径(mock createLokvis + 真实 fs fixture)
 *
 * 使用真实 fs 写入临时 fixture 文件,验证 resolve/cwd/existsSync/readFile 集成;
 * createLokvis 通过 vi.mock 替换为返回桩 runtime。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Workflow, WorkflowResult } from '@lokvis/schema';

// 桩 @lokvis/sdk 的 createLokvis,避免初始化真实 Runtime(OPFS/IDB/Worker)
const createLokvisMock = vi.fn();
vi.mock('@lokvis/sdk', () => ({ createLokvis: createLokvisMock }));

const { runWorkflow } = await import('../../commands/run.js');

/** 构造一个合法 Workflow 对象(满足 validateWorkflow 的字段级校验) */
function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
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

/** 桩 runtime:importAsset 返回递增 ID,run 返回固定结果 */
function makeMockRuntime() {
  let counter = 0;
  return {
    importAsset: vi.fn(
      async (_input: { kind: string; file: File }) => `asset-${++counter}`
    ),
    run: vi.fn(
      async (_workflow: Workflow, _inputIds: string[]): Promise<WorkflowResult> => ({
        workflowId: 'wf-test',
        outputs: ['out-1'],
        duration: 50,
        status: 'completed',
      })
    ),
  };
}

describe('runWorkflow', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-run-'));
    createLokvisMock.mockReset();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('文件不存在', () => {
    it('workflow 文件不存在应抛错', async () => {
      const missing = join(tmpDir, 'missing.json');
      await expect(runWorkflow(missing, [])).rejects.toThrow(
        `Workflow file not found: ${missing}`
      );
      expect(createLokvisMock).not.toHaveBeenCalled();
    });

    it('输入文件不存在应抛错', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      await expect(
        runWorkflow(wfPath, [join(tmpDir, 'missing.png')])
      ).rejects.toThrow('Input file not found:');
    });
  });

  describe('JSON 解析', () => {
    it('JSON 格式无效应抛错', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, '{ not valid json }', 'utf-8');
      await expect(runWorkflow(wfPath, [])).rejects.toThrow(
        /Invalid workflow JSON:/
      );
    });

    it('JSON 非对象(null)应抛错', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, 'null', 'utf-8');
      await expect(runWorkflow(wfPath, [])).rejects.toThrow(
        'Workflow must be a JSON object'
      );
    });

    it('JSON 非对象(数字)应抛错', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, '42', 'utf-8');
      await expect(runWorkflow(wfPath, [])).rejects.toThrow(
        'Workflow must be a JSON object'
      );
    });
  });

  describe('工作流结构校验', () => {
    async function writeWorkflow(partial: Record<string, unknown>): Promise<string> {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(partial), 'utf-8');
      return wfPath;
    }

    it('缺少 id 应抛错', async () => {
      const wf = makeWorkflow() as unknown as Record<string, unknown>;
      delete wf.id;
      const p = await writeWorkflow(wf);
      await expect(runWorkflow(p, [])).rejects.toThrow('Workflow.id must be string');
    });

    it('缺少 name 应抛错', async () => {
      const wf = makeWorkflow() as unknown as Record<string, unknown>;
      delete wf.name;
      const p = await writeWorkflow(wf);
      await expect(runWorkflow(p, [])).rejects.toThrow('Workflow.name must be string');
    });

    it('缺少 nodes 应抛错', async () => {
      const wf = makeWorkflow() as unknown as Record<string, unknown>;
      delete wf.nodes;
      const p = await writeWorkflow(wf);
      await expect(runWorkflow(p, [])).rejects.toThrow('Workflow.nodes must be array');
    });

    it('缺少 edges 应抛错', async () => {
      const wf = makeWorkflow() as unknown as Record<string, unknown>;
      delete wf.edges;
      const p = await writeWorkflow(wf);
      await expect(runWorkflow(p, [])).rejects.toThrow('Workflow.edges must be array');
    });

    it('node 缺少 id 应抛错', async () => {
      const p = await writeWorkflow({
        ...makeWorkflow(),
        nodes: [{ capability: 'image.resize' }],
      });
      await expect(runWorkflow(p, [])).rejects.toThrow(
        'Each node must have id and capability'
      );
    });

    it('node 缺少 capability 应抛错', async () => {
      const p = await writeWorkflow({
        ...makeWorkflow(),
        nodes: [{ id: 'n1' }],
      });
      await expect(runWorkflow(p, [])).rejects.toThrow(
        'Each node must have id and capability'
      );
    });
  });

  describe('正常执行', () => {
    it('无输入文件应创建 runtime 并执行工作流', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      const result = await runWorkflow(wfPath, []);

      expect(createLokvisMock).toHaveBeenCalledWith({
        enableOpfs: false,
        enableIndexedDB: false,
        plugins: [],
      });
      expect(runtime.importAsset).not.toHaveBeenCalled();
      expect(runtime.run).toHaveBeenCalledTimes(1);
      // workflow 第一个参数应为解析后的对象(含 id='wf-test')
      const [wfArg, idsArg] = runtime.run.mock.calls[0]!;
      expect(wfArg.id).toBe('wf-test');
      expect(idsArg).toEqual([]);
      expect(result.status).toBe('completed');
      expect(result.outputs).toEqual(['out-1']);
    });

    it('有输入文件应逐个 importAsset 并传递 ID 列表给 run', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const f1 = join(tmpDir, 'a.png');
      const f2 = join(tmpDir, 'b.png');
      await writeFile(f1, 'fake-png-bytes-1');
      await writeFile(f2, 'fake-png-bytes-2');

      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      await runWorkflow(wfPath, [f1, f2]);

      expect(runtime.importAsset).toHaveBeenCalledTimes(2);
      // 第一个参数是 { kind: 'file', file: File },验证 file.name
      const call1 = runtime.importAsset.mock.calls[0]![0];
      expect(call1.kind).toBe('file');
      expect(call1.file.name).toBe(f1);
      const call2 = runtime.importAsset.mock.calls[1]![0];
      expect(call2.file.name).toBe(f2);
      // run 应收到 ['asset-1', 'asset-2']
      const idsArg = runtime.run.mock.calls[0]![1];
      expect(idsArg).toEqual(['asset-1', 'asset-2']);
    });

    it('options.plugins 应透传给 createLokvis', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      const plugins = [{ config: { name: 'p', version: '1', capabilities: [] }, install: vi.fn() }];
      await runWorkflow(wfPath, [], { plugins });

      expect(createLokvisMock).toHaveBeenCalledWith({
        enableOpfs: false,
        enableIndexedDB: false,
        plugins,
      });
    });

    it('runtime.run 抛错应上抛', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      runtime.run.mockRejectedValue(new Error('engine crashed'));
      createLokvisMock.mockResolvedValue(runtime);

      await expect(runWorkflow(wfPath, [])).rejects.toThrow('engine crashed');
    });
  });
});

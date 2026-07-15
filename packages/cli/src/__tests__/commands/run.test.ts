/**
 * `lokvis run <workflow.json> [files...]` 命令单元测试
 *
 * 验证 runWorkflow 的:
 * 1. 文件不存在错误处理
 * 2. JSON 解析错误处理
 * 3. 工作流结构校验(各字段缺失场景)
 * 4. 输入文件不存在错误处理
 * 5. 正常执行路径(mock createLokvis + 真实 fs fixture)
 * 6. 默认注入 imageToolsPluginNode + injectImagePlugin: false 禁用
 * 7. --output 选项:成功写入 / outputs 为空时抛错
 *
 * 使用真实 fs 写入临时 fixture 文件,验证 resolve/cwd/existsSync/readFile 集成;
 * createLokvis 与 imageToolsPluginNode 通过 vi.mock 替换为桩。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Workflow, WorkflowResult } from '@lokvis/schema';

// 桩 @lokvis/sdk 的 createLokvis,避免初始化真实 Runtime(OPFS/IDB/Worker)
const createLokvisMock = vi.fn();
vi.mock('@lokvis/sdk', () => ({ createLokvis: createLokvisMock }));

// 桩 @lokvis/plugin-image/node 的 imageToolsPluginNode,
// 返回一个带识别标记的 PluginLoadEntry,便于断言"默认已注入"
const imagePluginMock = {
  config: { name: '@lokvis/plugin-image-node-mock', version: '0.0.0', capabilities: [] },
  install: vi.fn(),
};
const imageToolsPluginNodeMock = vi.fn().mockResolvedValue(imagePluginMock);
vi.mock('@lokvis/plugin-image/node', () => ({
  imageToolsPluginNode: imageToolsPluginNodeMock,
}));

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

/** 桩 runtime:importAsset 返回递增 ID,run 返回固定结果,exportAsset 返回固定 Blob */
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
    exportAsset: vi.fn(async (_id: string) => new Blob(['exported-bytes'])),
  };
}

describe('runWorkflow', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-run-'));
    createLokvisMock.mockReset();
    imageToolsPluginNodeMock.mockReset();
    imageToolsPluginNodeMock.mockResolvedValue(imagePluginMock);
    imagePluginMock.install.mockClear();
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
        /Invalid workflow: Expected object, received null/
      );
    });

    it('JSON 非对象(数字)应抛错', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, '42', 'utf-8');
      await expect(runWorkflow(wfPath, [])).rejects.toThrow(
        /Invalid workflow: Expected object, received number/
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
      await expect(runWorkflow(p, [])).rejects.toThrow(/Invalid workflow: id: Required/);
    });

    it('缺少 name 应抛错', async () => {
      const wf = makeWorkflow() as unknown as Record<string, unknown>;
      delete wf.name;
      const p = await writeWorkflow(wf);
      await expect(runWorkflow(p, [])).rejects.toThrow(/Invalid workflow: name: Required/);
    });

    it('缺少 nodes 应抛错', async () => {
      const wf = makeWorkflow() as unknown as Record<string, unknown>;
      delete wf.nodes;
      const p = await writeWorkflow(wf);
      await expect(runWorkflow(p, [])).rejects.toThrow(/Invalid workflow: nodes: Required/);
    });

    it('缺少 edges 应抛错', async () => {
      const wf = makeWorkflow() as unknown as Record<string, unknown>;
      delete wf.edges;
      const p = await writeWorkflow(wf);
      await expect(runWorkflow(p, [])).rejects.toThrow(/Invalid workflow: edges: Required/);
    });

    it('node 缺少 id 应抛错', async () => {
      const p = await writeWorkflow({
        ...makeWorkflow(),
        nodes: [{ capability: 'image.resize' }],
      });
      await expect(runWorkflow(p, [])).rejects.toThrow(
        /Invalid workflow: nodes\.0\.id: Required/
      );
    });

    it('transform 节点缺少 capability 应抛错', async () => {
      const p = await writeWorkflow({
        ...makeWorkflow(),
        nodes: [{ id: 'n1', type: 'transform' }],
      });
      await expect(runWorkflow(p, [])).rejects.toThrow(
        /transform 节点必须指定 capability/
      );
    });
  });

  describe('正常执行', () => {
    it('无输入文件应创建 runtime 并执行工作流(默认注入 image plugin)', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      const result = await runWorkflow(wfPath, []);

      // 默认调用 imageToolsPluginNode 一次,并把返回值作为 plugins[0]
      expect(imageToolsPluginNodeMock).toHaveBeenCalledTimes(1);
      expect(createLokvisMock).toHaveBeenCalledWith({
        enableOpfs: false,
        enableIndexedDB: false,
        plugins: [imagePluginMock],
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

    it('options.plugins 应在 image plugin 之后追加', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      const userPlugin = {
        config: { name: 'p', version: '1', capabilities: [] },
        install: vi.fn(),
      };
      await runWorkflow(wfPath, [], { plugins: [userPlugin] });

      // 顺序:image plugin 在前,用户插件在后(允许用户覆盖同名能力)
      expect(createLokvisMock).toHaveBeenCalledWith({
        enableOpfs: false,
        enableIndexedDB: false,
        plugins: [imagePluginMock, userPlugin],
      });
    });

    it('injectImagePlugin: false 应禁用默认 image plugin 注入', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      await runWorkflow(wfPath, [], { injectImagePlugin: false });

      expect(imageToolsPluginNodeMock).not.toHaveBeenCalled();
      expect(createLokvisMock).toHaveBeenCalledWith({
        enableOpfs: false,
        enableIndexedDB: false,
        plugins: [],
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

  describe('--output 选项', () => {
    it('指定 output 应把第一个输出 Asset 写入文件', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      const outPath = join(tmpDir, 'out.png');
      await runWorkflow(wfPath, [], { output: outPath });

      // exportAsset 应被调用一次,id 为 result.outputs[0] = 'out-1'
      expect(runtime.exportAsset).toHaveBeenCalledTimes(1);
      expect(runtime.exportAsset.mock.calls[0]![0]).toBe('out-1');
      // 文件应已写入,内容为 mock Blob 的 'exported-bytes'
      expect(existsSync(outPath)).toBe(true);
      const written = await readFile(outPath);
      expect(written.toString()).toBe('exported-bytes');
    });

    it('outputs 为空时指定 output 应抛错', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      // 让 run 返回 outputs: []
      runtime.run.mockResolvedValue({
        workflowId: 'wf-test',
        outputs: [],
        duration: 1,
        status: 'completed',
      });
      createLokvisMock.mockResolvedValue(runtime);

      const outPath = join(tmpDir, 'should-not-exist.png');
      await expect(runWorkflow(wfPath, [], { output: outPath })).rejects.toThrow(
        /--output specified but workflow produced no outputs/
      );
      expect(runtime.exportAsset).not.toHaveBeenCalled();
      expect(existsSync(outPath)).toBe(false);
    });

    it('未指定 output 时不应调用 exportAsset', async () => {
      const wfPath = join(tmpDir, 'wf.json');
      await writeFile(wfPath, JSON.stringify(makeWorkflow()), 'utf-8');
      const runtime = makeMockRuntime();
      createLokvisMock.mockResolvedValue(runtime);

      await runWorkflow(wfPath, []);
      expect(runtime.exportAsset).not.toHaveBeenCalled();
    });
  });
});

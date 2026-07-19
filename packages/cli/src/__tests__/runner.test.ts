/**
 * CLI 命令分发器(runCLI)单元测试
 *
 * 验证各子命令的分发逻辑与错误处理。`run` / `plugin create` 子命令的
 * 实际业务逻辑由各自的 commands/* 模块负责,本测试通过 vi.mock 替换它们,
 * 仅验证 runCLI 的分支选择、参数拆分与输出格式。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 桩 commands/* 模块,验证 runCLI 的分发行为而非业务实现
const runWorkflowMock = vi.fn();
const createPluginMock = vi.fn();
const validateWorkflowFileMock = vi.fn();
const listWorkflowsMock = vi.fn();
const formatValidateResultMock = vi.fn((r: unknown) => `formatted:${JSON.stringify(r)}`);
const formatListEntriesMock = vi.fn((e: unknown[]) => `list:${e.length}`);
vi.mock('../commands/run.js', () => ({ runWorkflow: runWorkflowMock }));
vi.mock('../commands/plugin-create.js', () => ({
  createPlugin: createPluginMock,
}));
vi.mock('../commands/validate.js', () => ({
  validateWorkflowFile: validateWorkflowFileMock,
  formatValidateResult: formatValidateResultMock,
}));
vi.mock('../commands/list.js', () => ({
  listWorkflows: listWorkflowsMock,
  formatListEntries: formatListEntriesMock,
}));
// capabilities 是纯函数,直接透传真实模块
// (BUILTIN_CAPABILITIES 来自 @lokvis/capability,无副作用)

const { runCLI } = await import('../runner.js');
const { version } = await import('../version.js');

/** 捕获 process.stdout.write 的输出(避免 vi.spyOn 重载类型问题) */
function captureStdout(): {
  writes: string[];
  restore: () => void;
} {
  const writes: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  }) as typeof process.stdout.write;
  return { writes, restore: () => { process.stdout.write = original; } };
}

describe('runCLI', () => {
  let stdout: ReturnType<typeof captureStdout>;

  beforeEach(() => {
    stdout = captureStdout();
    runWorkflowMock.mockReset();
    createPluginMock.mockReset();
    validateWorkflowFileMock.mockReset();
    listWorkflowsMock.mockReset();
    formatValidateResultMock.mockClear();
    formatListEntriesMock.mockClear();
  });

  // 在每个测试后恢复 stdout,避免污染其他测试套件
  afterEach(() => {
    stdout.restore();
  });

  describe('help 命令', () => {
    it('无参数时应输出 help', async () => {
      await runCLI([]);
      const out = stdout.writes.join('');
      expect(out).toContain('Lokvis CLI');
      expect(out).toContain('Usage:');
    });

    it('"help" 参数应输出 help', async () => {
      await runCLI(['help']);
      const out = stdout.writes.join('');
      expect(out).toContain('Lokvis CLI');
    });

    it('"--help" / "-h" 应输出 help', async () => {
      await runCLI(['--help']);
      await runCLI(['-h']);
      const out = stdout.writes.join('');
      expect(out).toContain('Usage:');
    });
  });

  describe('version 命令', () => {
    it.each(['version', '--version', '-v'])(
      '"%s" 应输出版本号',
      async (cmd) => {
        await runCLI([cmd]);
        const out = stdout.writes.join('');
        expect(out).toContain(`lokvis v${version}`);
      }
    );
  });

  describe('run 命令', () => {
    it('缺少 workflowPath 应抛出 Usage 错误', async () => {
      await expect(runCLI(['run'])).rejects.toThrow(
        'Usage: lokvis run <workflow.json> [files...]'
      );
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });

    it('有 workflowPath 应委托 runWorkflow 并输出 JSON', async () => {
      runWorkflowMock.mockResolvedValue({
        workflowId: 'wf-1',
        outputs: ['out-1'],
        duration: 100,
        status: 'completed',
      });
      await runCLI(['run', './wf.json', 'a.png', 'b.png']);
      expect(runWorkflowMock).toHaveBeenCalledWith(
        './wf.json',
        ['a.png', 'b.png'],
        {}
      );
      const out = stdout.writes.join('');
      expect(out).toContain('"workflowId": "wf-1"');
      expect(out).toContain('"status": "completed"');
    });

    it('runWorkflow 抛错时应上抛', async () => {
      runWorkflowMock.mockRejectedValue(new Error('Workflow file not found'));
      await expect(runCLI(['run', './missing.json'])).rejects.toThrow(
        'Workflow file not found'
      );
    });

    it('--input/-i 选项应作为输入文件传入(可与位置参数混用)', async () => {
      runWorkflowMock.mockResolvedValue({
        workflowId: 'wf-1',
        outputs: ['out-1'],
        duration: 1,
        status: 'completed',
      });
      await runCLI([
        'run', './wf.json', 'pos.png',
        '--input', 'a.png', '-i', 'b.png',
      ]);
      // 位置参数在前,--input 文件按出现顺序追加
      expect(runWorkflowMock).toHaveBeenCalledWith(
        './wf.json',
        ['pos.png', 'a.png', 'b.png'],
        {}
      );
    });

    it('--input= 形式也应被解析', async () => {
      runWorkflowMock.mockResolvedValue({
        workflowId: 'wf-1',
        outputs: ['out-1'],
        duration: 1,
        status: 'completed',
      });
      await runCLI(['run', './wf.json', '--input=a.png']);
      expect(runWorkflowMock).toHaveBeenCalledWith(
        './wf.json',
        ['a.png'],
        {}
      );
    });

    it('--output/-o 选项应作为 options.output 传入', async () => {
      runWorkflowMock.mockResolvedValue({
        workflowId: 'wf-1',
        outputs: ['out-1'],
        duration: 1,
        status: 'completed',
      });
      await runCLI(['run', './wf.json', 'a.png', '--output', 'out.png']);
      expect(runWorkflowMock).toHaveBeenCalledWith(
        './wf.json',
        ['a.png'],
        { output: 'out.png' }
      );
    });

    it('-o 短选项与 --output= 形式也应被解析', async () => {
      runWorkflowMock.mockResolvedValue({
        workflowId: 'wf-1',
        outputs: ['out-1'],
        duration: 1,
        status: 'completed',
      });
      await runCLI(['run', './wf.json', '-o', 'o1.png']);
      expect(runWorkflowMock).toHaveBeenCalledWith(
        './wf.json',
        [],
        { output: 'o1.png' }
      );
      runWorkflowMock.mockClear();
      await runCLI(['run', './wf.json', '--output=o2.png']);
      expect(runWorkflowMock).toHaveBeenCalledWith(
        './wf.json',
        [],
        { output: 'o2.png' }
      );
    });

    it('--input 缺值应抛出 Usage 错误', async () => {
      await expect(runCLI(['run', './wf.json', '--input'])).rejects.toThrow(
        /missing value for --input/
      );
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });

    it('--output 缺值应抛出 Usage 错误', async () => {
      await expect(runCLI(['run', './wf.json', '-o'])).rejects.toThrow(
        /missing value for -o/
      );
      expect(runWorkflowMock).not.toHaveBeenCalled();
    });
  });

  describe('capabilities 命令', () => {
    it.each(['capabilities', 'caps'])(
      '"%s" 应列出内置能力',
      async (cmd) => {
        await runCLI([cmd]);
        const out = stdout.writes.join('');
        expect(out).toMatch(/^Capabilities \(\d+\):/);
        // 每行格式: 2 空格 + name(padEnd 24) + description
        expect(out).toContain('  ');
      }
    );
  });

  describe('plugin 命令', () => {
    it('子命令非 create 应抛出 Usage 错误', async () => {
      await expect(runCLI(['plugin', 'list'])).rejects.toThrow(
        /Usage: lokvis plugin create <name>/
      );
      expect(createPluginMock).not.toHaveBeenCalled();
    });

    it('缺少 name 应抛出 Usage 错误', async () => {
      await expect(runCLI(['plugin', 'create'])).rejects.toThrow(
        /Usage: lokvis plugin create <name>/
      );
      expect(createPluginMock).not.toHaveBeenCalled();
    });

    it('create <name> 应委托 createPlugin 并输出成功消息', async () => {
      createPluginMock.mockResolvedValue('/abs/path/my-plugin');
      await runCLI(['plugin', 'create', 'my-plugin']);
      // 未提供 --author/--description 时,options 仍为对象(author/description 均为 undefined)
      expect(createPluginMock).toHaveBeenCalledWith('my-plugin', undefined, {
        author: undefined,
        description: undefined,
      });
      const out = stdout.writes.join('');
      expect(out).toContain('✓ Created plugin "my-plugin" at /abs/path/my-plugin');
    });

    it('create <name> <target> 应传递 target', async () => {
      createPluginMock.mockResolvedValue('/abs/path/to/dir');
      await runCLI(['plugin', 'create', 'my-plugin', './some/dir']);
      expect(createPluginMock).toHaveBeenCalledWith('my-plugin', './some/dir', {
        author: undefined,
        description: undefined,
      });
    });

    it('create <name> --author <a> 应传递 author', async () => {
      createPluginMock.mockResolvedValue('/abs/path/my-plugin');
      await runCLI(['plugin', 'create', 'my-plugin', '--author', 'alice']);
      expect(createPluginMock).toHaveBeenCalledWith('my-plugin', undefined, {
        author: 'alice',
        description: undefined,
      });
    });

    it('create <name> --description <d> 应传递 description', async () => {
      createPluginMock.mockResolvedValue('/abs/path/my-plugin');
      await runCLI(['plugin', 'create', 'my-plugin', '--description', 'A cool plugin']);
      expect(createPluginMock).toHaveBeenCalledWith('my-plugin', undefined, {
        author: undefined,
        description: 'A cool plugin',
      });
    });

    it('create <name> --author=a --description=b 应解析 = 形式', async () => {
      createPluginMock.mockResolvedValue('/abs/path/my-plugin');
      await runCLI(['plugin', 'create', 'my-plugin', '--author=alice', '--description=cool']);
      expect(createPluginMock).toHaveBeenCalledWith('my-plugin', undefined, {
        author: 'alice',
        description: 'cool',
      });
    });

    it('create <name> --author 缺值应抛出 Usage 错误', async () => {
      await expect(
        runCLI(['plugin', 'create', 'my-plugin', '--author'])
      ).rejects.toThrow(/missing value for --author/);
      expect(createPluginMock).not.toHaveBeenCalled();
    });

    it('create <name> 未知选项应抛错', async () => {
      await expect(
        runCLI(['plugin', 'create', 'my-plugin', '--unknown'])
      ).rejects.toThrow(/Unknown option for plugin create: --unknown/);
      expect(createPluginMock).not.toHaveBeenCalled();
    });

    it('create <name> 多余位置参数应抛错', async () => {
      await expect(
        runCLI(['plugin', 'create', 'my-plugin', './dir1', './dir2'])
      ).rejects.toThrow(/Unexpected positional argument: \.\/dir2/);
      expect(createPluginMock).not.toHaveBeenCalled();
    });
  });

  describe('validate 命令', () => {
    it('缺少 workflowPath 应抛出 Usage 错误', async () => {
      await expect(runCLI(['validate'])).rejects.toThrow(
        /Usage: lokvis validate <workflow\.json>/
      );
      expect(validateWorkflowFileMock).not.toHaveBeenCalled();
    });

    it('validate <path> 应委托 validateWorkflowFile 并输出格式化结果', async () => {
      const result = { valid: true, errors: [], summary: { id: 'wf' } };
      validateWorkflowFileMock.mockResolvedValue(result);
      await runCLI(['validate', './wf.json']);
      expect(validateWorkflowFileMock).toHaveBeenCalledWith('./wf.json', {
        maxSteps: undefined,
        json: false,
      });
      // 应调用 formatValidateResult
      expect(formatValidateResultMock).toHaveBeenCalledWith(result);
      // process.exitCode 不应被设置(校验成功)
      expect(process.exitCode).toBeUndefined();
    });

    it('校验失败时应设置 process.exitCode = 1', async () => {
      const result = {
        valid: false,
        errors: [{ path: 'id', message: 'Required' }],
      };
      validateWorkflowFileMock.mockResolvedValue(result);
      // 保存原 exitCode 以便恢复
      const origExitCode = process.exitCode;
      process.exitCode = undefined;
      try {
        await runCLI(['validate', './bad.json']);
        expect(process.exitCode).toBe(1);
      } finally {
        process.exitCode = origExitCode;
      }
    });

    it('--json 选项应作为 json: true 传入', async () => {
      const result = { valid: true, errors: [], summary: { id: 'wf' } };
      validateWorkflowFileMock.mockResolvedValue(result);
      await runCLI(['validate', './wf.json', '--json']);
      expect(validateWorkflowFileMock).toHaveBeenCalledWith('./wf.json', {
        maxSteps: undefined,
        json: true,
      });
      const out = stdout.writes.join('');
      // JSON 输出应包含 valid 字段
      expect(out).toContain('"valid": true');
    });

    it('--max-steps <n> 应作为 maxSteps 传入', async () => {
      validateWorkflowFileMock.mockResolvedValue({ valid: true, errors: [] });
      await runCLI(['validate', './wf.json', '--max-steps', '10']);
      expect(validateWorkflowFileMock).toHaveBeenCalledWith('./wf.json', {
        maxSteps: 10,
        json: false,
      });
    });

    it('--max-steps 非正整数应抛错', async () => {
      await expect(
        runCLI(['validate', './wf.json', '--max-steps', '0'])
      ).rejects.toThrow(/--max-steps must be a positive integer/);
      await expect(
        runCLI(['validate', './wf.json', '--max-steps', 'abc'])
      ).rejects.toThrow(/--max-steps must be a positive integer/);
    });

    it('未知选项应抛错', async () => {
      await expect(
        runCLI(['validate', './wf.json', '--unknown'])
      ).rejects.toThrow(/Unknown option for validate: --unknown/);
    });
  });

  describe('list 命令', () => {
    it('无参数应使用默认 cwd(dir=undefined)', async () => {
      listWorkflowsMock.mockResolvedValue([]);
      await runCLI(['list']);
      expect(listWorkflowsMock).toHaveBeenCalledWith(undefined, {
        includeInvalid: false,
        json: false,
        maxDepth: undefined,
      });
    });

    it('list <dir> 应传递目录路径', async () => {
      listWorkflowsMock.mockResolvedValue([]);
      await runCLI(['list', './workflows']);
      expect(listWorkflowsMock).toHaveBeenCalledWith('./workflows', {
        includeInvalid: false,
        json: false,
        maxDepth: undefined,
      });
    });

    it('--all 应启用 includeInvalid', async () => {
      listWorkflowsMock.mockResolvedValue([]);
      await runCLI(['list', './workflows', '--all']);
      expect(listWorkflowsMock).toHaveBeenCalledWith('./workflows', {
        includeInvalid: true,
        json: false,
        maxDepth: undefined,
      });
    });

    it('--json 应启用 json 输出', async () => {
      const entries = [
        { path: '/a.json', relativePath: 'a.json', valid: true, errors: [] },
      ];
      listWorkflowsMock.mockResolvedValue(entries);
      await runCLI(['list', './workflows', '--json']);
      expect(listWorkflowsMock).toHaveBeenCalledWith('./workflows', {
        includeInvalid: false,
        json: true,
        maxDepth: undefined,
      });
      // JSON 输出应包含文件路径
      const out = stdout.writes.join('');
      expect(out).toContain('"relativePath": "a.json"');
    });

    it('--max-depth <n> 应传递递归深度', async () => {
      listWorkflowsMock.mockResolvedValue([]);
      await runCLI(['list', './workflows', '--max-depth', '3']);
      expect(listWorkflowsMock).toHaveBeenCalledWith('./workflows', {
        includeInvalid: false,
        json: false,
        maxDepth: 3,
      });
    });

    it('--max-depth 非负整数校验', async () => {
      await expect(
        runCLI(['list', './workflows', '--max-depth', '-1'])
      ).rejects.toThrow(/--max-depth must be a non-negative integer/);
      await expect(
        runCLI(['list', './workflows', '--max-depth', 'abc'])
      ).rejects.toThrow(/--max-depth must be a non-negative integer/);
    });

    it('未知选项应抛错', async () => {
      await expect(
        runCLI(['list', './workflows', '--unknown'])
      ).rejects.toThrow(/Unknown option for list: --unknown/);
    });
  });

  describe('未知命令', () => {
    it('应抛出 Unknown command 错误并附带 help', async () => {
      await expect(runCLI(['foobar'])).rejects.toThrow(/Unknown command: foobar/);
      // 验证错误消息中包含 help 文本(便于用户排查)
      await expect(runCLI(['foobar'])).rejects.toThrow(/Usage:/);
    });
  });
});

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
vi.mock('../commands/run.js', () => ({ runWorkflow: runWorkflowMock }));
vi.mock('../commands/plugin-create.js', () => ({
  createPlugin: createPluginMock,
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
        'Usage: lokvis plugin create <name> [target-dir]'
      );
      expect(createPluginMock).not.toHaveBeenCalled();
    });

    it('缺少 name 应抛出 Usage 错误', async () => {
      await expect(runCLI(['plugin', 'create'])).rejects.toThrow(
        'Usage: lokvis plugin create <name> [target-dir]'
      );
      expect(createPluginMock).not.toHaveBeenCalled();
    });

    it('create <name> 应委托 createPlugin 并输出成功消息', async () => {
      createPluginMock.mockResolvedValue('/abs/path/my-plugin');
      await runCLI(['plugin', 'create', 'my-plugin']);
      expect(createPluginMock).toHaveBeenCalledWith('my-plugin', undefined);
      const out = stdout.writes.join('');
      expect(out).toContain('✓ Created plugin "my-plugin" at /abs/path/my-plugin');
    });

    it('create <name> <target> 应传递 target', async () => {
      createPluginMock.mockResolvedValue('/abs/path/to/dir');
      await runCLI(['plugin', 'create', 'my-plugin', './some/dir']);
      expect(createPluginMock).toHaveBeenCalledWith('my-plugin', './some/dir');
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

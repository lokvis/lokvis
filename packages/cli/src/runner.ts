/**
 * lokvis CLI 命令分发器
 *
 * 命令:
 * - run <workflow.json> [files...] [--input/-i <path>...] [--output/-o <path>]
 * - validate <workflow.json> [--max-steps <n>] [--json]
 * - list [dir] [--all] [--json]
 * - capabilities
 * - plugin create <name> [target-dir] [--author <a>] [--description <d>]
 * - version
 * - help
 */

import { runWorkflow } from './commands/run.js';
import { listCapabilities } from './commands/capabilities.js';
import { createPlugin } from './commands/plugin-create.js';
import { validateWorkflowFile, formatValidateResult } from './commands/validate.js';
import { listWorkflows, formatListEntries } from './commands/list.js';
import { version } from './version.js';

const HELP = `Lokvis CLI v${version}

Usage:
  lokvis <command> [options]

Commands:
  run <workflow.json> [files...]   Run a workflow on the given input files
  validate <workflow.json>         Validate a workflow file without executing
  list [dir]                       List workflow files in a directory
  capabilities                     List built-in capabilities
  plugin create <name>             Scaffold a new plugin package
  version                          Show CLI version
  help                             Show this help message

Options for \`run\`:
  -i, --input <path>     Input file (can be repeated; also accepted as positional)
  -o, --output <path>    Write the first output Asset to this file path

Options for \`validate\`:
  --max-steps <n>        Max node count (default 5, matching MAX_WORKFLOW_STEPS)
  --json                 Output result as JSON (for CI)

Options for \`list\`:
  --all                  Include invalid .json files (showing first error)
  --json                 Output result as JSON array (for CI)
  --max-depth <n>        Max recursion depth (default unlimited)

Options for \`plugin create\`:
  --author <name>        Plugin author (default 'anonymous')
  --description <text>   Plugin description

Examples:
  lokvis run ./my-workflow.json ./input.png
  lokvis run ./my-workflow.json --input a.png --input b.png --output out.png
  lokvis validate ./my-workflow.json
  lokvis validate ./my-workflow.json --json
  lokvis list ./workflows
  lokvis capabilities
  lokvis plugin create my-plugin --author alice --description "A cool plugin"
`;

export async function runCLI(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  switch (command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(HELP);
      return;

    case 'version':
    case '--version':
    case '-v':
      process.stdout.write(`lokvis v${version}\n`);
      return;

    case 'run': {
      const [workflowPath, ...rest2] = rest;
      if (!workflowPath) {
        throw new Error('Usage: lokvis run <workflow.json> [files...]');
      }
      // 解析 --input/-i (可重复) 与 --output/-o (单值) 选项;
      // 其余参数作为位置输入文件。--input 与位置参数可混用,最终合并为 files 列表。
      const positionals: string[] = [];
      const inputFiles: string[] = [];
      let output: string | undefined;
      for (let i = 0; i < rest2.length; i++) {
        const arg = rest2[i]!;
        if (arg === '--input' || arg === '-i') {
          const next = rest2[++i];
          if (!next) {
            throw new Error(`Usage: lokvis run <workflow.json> [files...] (missing value for ${arg})`);
          }
          inputFiles.push(next);
        } else if (arg === '--output' || arg === '-o') {
          const next = rest2[++i];
          if (!next) {
            throw new Error(`Usage: lokvis run <workflow.json> [files...] (missing value for ${arg})`);
          }
          output = next;
        } else if (arg.startsWith('--input=')) {
          inputFiles.push(arg.slice('--input='.length));
        } else if (arg.startsWith('--output=')) {
          output = arg.slice('--output='.length);
        } else {
          positionals.push(arg);
        }
      }
      const files = [...positionals, ...inputFiles];
      const result = await runWorkflow(
        workflowPath,
        files,
        output ? { output } : {}
      );
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      return;
    }

    case 'validate': {
      const [workflowPath, ...rest2] = rest;
      if (!workflowPath) {
        throw new Error('Usage: lokvis validate <workflow.json> [--max-steps <n>] [--json]');
      }
      // 解析 --max-steps <n> 与 --json 选项
      let maxSteps: number | undefined;
      let json = false;
      for (let i = 0; i < rest2.length; i++) {
        const arg = rest2[i]!;
        if (arg === '--max-steps') {
          const next = rest2[++i];
          if (!next) {
            throw new Error(`Usage: lokvis validate <workflow.json> (missing value for ${arg})`);
          }
          const n = Number(next);
          if (!Number.isInteger(n) || n <= 0) {
            throw new Error(`--max-steps must be a positive integer, got: ${next}`);
          }
          maxSteps = n;
        } else if (arg.startsWith('--max-steps=')) {
          const val = arg.slice('--max-steps='.length);
          const n = Number(val);
          if (!Number.isInteger(n) || n <= 0) {
            throw new Error(`--max-steps must be a positive integer, got: ${val}`);
          }
          maxSteps = n;
        } else if (arg === '--json') {
          json = true;
        } else {
          throw new Error(`Unknown option for validate: ${arg}`);
        }
      }
      const result = await validateWorkflowFile(workflowPath, { maxSteps, json });
      if (json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } else {
        process.stdout.write(formatValidateResult(result));
      }
      // 校验失败时退出码 1,便于 CI 检测
      if (!result.valid) {
        process.exitCode = 1;
      }
      return;
    }

    case 'list': {
      const positionalArgs: string[] = [];
      let includeInvalid = false;
      let json = false;
      let maxDepth: number | undefined;
      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i]!;
        if (arg === '--all' || arg === '--include-invalid') {
          includeInvalid = true;
        } else if (arg === '--json') {
          json = true;
        } else if (arg === '--max-depth') {
          const next = rest[++i];
          if (!next) {
            throw new Error(`Usage: lokvis list [dir] (missing value for ${arg})`);
          }
          const n = Number(next);
          if (!Number.isInteger(n) || n < 0) {
            throw new Error(`--max-depth must be a non-negative integer, got: ${next}`);
          }
          maxDepth = n;
        } else if (arg.startsWith('--max-depth=')) {
          const val = arg.slice('--max-depth='.length);
          const n = Number(val);
          if (!Number.isInteger(n) || n < 0) {
            throw new Error(`--max-depth must be a non-negative integer, got: ${val}`);
          }
          maxDepth = n;
        } else if (arg.startsWith('-')) {
          throw new Error(`Unknown option for list: ${arg}`);
        } else {
          positionalArgs.push(arg);
        }
      }
      // 第一个位置参数作为目录,其余忽略(避免误用)
      const dir = positionalArgs[0];
      const entries = await listWorkflows(dir, { includeInvalid, json, maxDepth });
      if (json) {
        process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
      } else {
        process.stdout.write(formatListEntries(entries));
      }
      return;
    }

    case 'capabilities':
    case 'caps': {
      const caps = listCapabilities();
      process.stdout.write(`Capabilities (${caps.length}):\n`);
      for (const cap of caps) {
        process.stdout.write(`  ${cap.name.padEnd(24)} ${cap.description}\n`);
      }
      return;
    }

    case 'plugin': {
      const [sub, name, ...rest2] = rest;
      if (sub !== 'create' || !name) {
        throw new Error('Usage: lokvis plugin create <name> [target-dir] [--author <a>] [--description <d>]');
      }
      // 解析 --author / --description 与位置 target-dir
      let target: string | undefined;
      let author: string | undefined;
      let description: string | undefined;
      for (let i = 0; i < rest2.length; i++) {
        const arg = rest2[i]!;
        if (arg === '--author') {
          const next = rest2[++i];
          if (!next) {
            throw new Error(`Usage: lokvis plugin create <name> (missing value for ${arg})`);
          }
          author = next;
        } else if (arg.startsWith('--author=')) {
          author = arg.slice('--author='.length);
        } else if (arg === '--description') {
          const next = rest2[++i];
          if (!next) {
            throw new Error(`Usage: lokvis plugin create <name> (missing value for ${arg})`);
          }
          description = next;
        } else if (arg.startsWith('--description=')) {
          description = arg.slice('--description='.length);
        } else if (arg.startsWith('-')) {
          throw new Error(`Unknown option for plugin create: ${arg}`);
        } else if (target === undefined) {
          target = arg;
        } else {
          throw new Error(`Unexpected positional argument: ${arg}`);
        }
      }
      const dir = await createPlugin(name, target, { author, description });
      process.stdout.write(`✓ Created plugin "${name}" at ${dir}\n`);
      return;
    }

    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }
}

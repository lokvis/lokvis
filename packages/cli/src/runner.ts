/**
 * lokvis CLI 命令分发器
 */

import { runWorkflow } from './commands/run.js';
import { listCapabilities } from './commands/capabilities.js';
import { createPlugin } from './commands/plugin-create.js';
import { version } from './version.js';

const HELP = `Lokvis CLI v${version}

Usage:
  lokvis <command> [options]

Commands:
  run <workflow.json> [files...]   Run a workflow on the given input files
  capabilities                     List built-in capabilities
  plugin create <name>             Scaffold a new plugin package
  version                          Show CLI version
  help                             Show this help message

Options for \`run\`:
  -i, --input <path>     Input file (can be repeated; also accepted as positional)
  -o, --output <path>    Write the first output Asset to this file path

Examples:
  lokvis run ./my-workflow.json ./input.png
  lokvis run ./my-workflow.json --input a.png --input b.png --output out.png
  lokvis capabilities
  lokvis plugin create my-plugin
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
      const [sub, name, target] = rest;
      if (sub !== 'create' || !name) {
        throw new Error('Usage: lokvis plugin create <name> [target-dir]');
      }
      const dir = await createPlugin(name, target);
      process.stdout.write(`✓ Created plugin "${name}" at ${dir}\n`);
      return;
    }

    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }
}

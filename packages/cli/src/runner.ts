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

Examples:
  lokvis run ./my-workflow.json ./input.png
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
      const [workflowPath, ...files] = rest;
      if (!workflowPath) {
        throw new Error('Usage: lokvis run <workflow.json> [files...]');
      }
      const result = await runWorkflow(workflowPath, files);
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

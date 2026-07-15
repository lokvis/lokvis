/**
 * @lokvis/cli
 *
 * Lokvis 命令行工具。
 *
 * 命令：
 * - `run <workflow.json> [files...]`：在 Node.js 中运行工作流
 *   (默认注入 `@lokvis/plugin-image/node` 的 sharp 引擎，可在 Node 中
 *   真实执行 image.resize / compress / convert / crop / watermark)
 * - `capabilities`：列出内置能力
 * - `plugin create <name>`：脚手架一个新插件目录
 * - `version`：显示版本号
 * - `help`：显示帮助
 *
 * `run` 选项：
 * - `-i, --input <path>`：输入文件(可重复,与位置参数等价)
 * - `-o, --output <path>`：把第一个输出 Asset 写入此路径
 */

export { runCLI } from './runner.js';
export { runWorkflow } from './commands/run.js';
export { listCapabilities } from './commands/capabilities.js';
export { createPlugin } from './commands/plugin-create.js';
export { version } from './version.js';

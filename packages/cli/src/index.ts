/**
 * @lokvis/cli
 *
 * Lokvis 命令行工具。
 *
 * 命令：
 * - `run <workflow.json> [files...]`：在 Node.js 中运行工作流（无浏览器环境）
 * - `capabilities`：列出内置能力
 * - `plugin create <name>`：脚手架一个新插件目录
 * - `version`：显示版本号
 * - `help`：显示帮助
 *
 * 注意：Runtime 设计为浏览器优先，CLI 主要用于工作流校验、
 * 能力查询、插件脚手架等无副作用操作。`run` 命令在 Node.js 中
 * 仅支持不依赖浏览器 API（如 Canvas）的能力。
 */

export { runCLI } from './runner.js';
export { runWorkflow } from './commands/run.js';
export { listCapabilities } from './commands/capabilities.js';
export { createPlugin } from './commands/plugin-create.js';
export { version } from './version.js';

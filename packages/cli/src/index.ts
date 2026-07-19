/**
 * @lokvis/cli
 *
 * Lokvis 命令行工具。
 *
 * 命令：
 * - `run <workflow.json> [files...]`：在 Node.js 中运行工作流
 *   (默认注入 `@lokvis/plugin-image/node` 的 sharp 引擎,可在 Node 中
 *   真实执行 image.resize / compress / convert / crop / watermark)
 * - `validate <workflow.json>`：校验 workflow 文件,不实际执行
 * - `list [dir]`：列出目录下的 workflow 文件
 * - `capabilities`：列出内置能力
 * - `plugin create <name>`：脚手架一个新插件目录
 * - `version`：显示版本号
 * - `help`：显示帮助
 *
 * `run` 选项：
 * - `-i, --input <path>`：输入文件(可重复,与位置参数等价)
 * - `-o, --output <path>`：把第一个输出 Asset 写入此路径
 *
 * `validate` 选项：
 * - `--max-steps <n>`：最大节点数(默认 5,即 MAX_WORKFLOW_STEPS)
 * - `--json`：JSON 格式输出(便于 CI 解析)
 *
 * `list` 选项：
 * - `--all`：包含未通过校验的 .json 文件
 * - `--json`：JSON 格式输出
 * - `--max-depth <n>`：最大递归深度
 *
 * `plugin create` 选项：
 * - `--author <name>`：插件作者(默认 'anonymous')
 * - `--description <text>`：插件描述
 */

export { runCLI } from './runner.js';
export { runWorkflow } from './commands/run.js';
export { validateWorkflowFile, formatValidateResult } from './commands/validate.js';
export type { ValidateOptions, ValidateResult } from './commands/validate.js';
export { listWorkflows, formatListEntries } from './commands/list.js';
export type { ListOptions, ListEntry } from './commands/list.js';
export { listCapabilities } from './commands/capabilities.js';
export { createPlugin } from './commands/plugin-create.js';
export type { CreatePluginOptions } from './commands/plugin-create.js';
export { version } from './version.js';

/**
 * re-export validateWorkflow(S1 P2:暴露 schema 校验器,便于用户在编程式 API 中复用)。
 *
 * 用户在 CI/CD 脚本中可能需要直接调用校验逻辑,无需通过 validateWorkflowFile
 * 读文件;例如从 HTTP 请求或 stdin 拿到 workflow JSON 后直接校验。
 */
export { validateWorkflow } from '@lokvis/schema';

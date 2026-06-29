#!/usr/bin/env node
/**
 * lokvis CLI 入口
 *
 * 用法：
 *   lokvis <command> [options]
 *
 * 命令：
 *   run <workflow.json> [files...]   运行工作流
 *   capabilities                     列出已注册能力
 *   plugin create <name>             脚手架一个新插件
 *   version                          显示版本号
 *   help                             显示帮助
 */
import { runCLI } from '../dist/index.js';

runCLI(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

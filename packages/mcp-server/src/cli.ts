#!/usr/bin/env node
/**
 * lokvis-mcp CLI 入口。
 *
 * 由 `npx @lokvis/mcp-server` 调用,启动 stdio 模式 MCP server。
 *
 * 环境变量:
 *   LOKVIS_WORKDIR - 工作目录(Node 模式资产读写根路径)
 *   LOKVIS_DOMAINS - 启用的能力域,逗号分隔(默认 'image')
 *   LOKVIS_MODE    - 运行模式 'stdio'(默认) | 'sse'
 *
 * 状态:Phase 2 骨架。实际启动逻辑在 Phase 2 W9-W10 实现。
 */

import { createLokvisMcpServer } from './server.js';

async function main(): Promise<void> {
  const workdir = process.env.LOKVIS_WORKDIR;
  const domains = process.env.LOKVIS_DOMAINS?.split(',').filter(Boolean) as
    | Array<'image' | 'pdf' | 'video' | 'audio' | 'ai'>
    | undefined;
  const mode = (process.env.LOKVIS_MODE as 'stdio' | 'sse' | undefined) ?? 'stdio';

  const { manifest } = await createLokvisMcpServer({
    workdir,
    domains,
    mode,
  });

  // Phase 2 W9-W10:启动实际 MCP transport
  console.error(`[lokvis-mcp] Manifest ready: ${manifest.tools.length} tools`);
  console.error(`[lokvis-mcp] Server start (stdio mode) — Phase 2 W9-W10 实现实际传输`);
  console.error('[lokvis-mcp] 当前为骨架,不响应 MCP 请求');
}

main().catch((err) => {
  console.error('[lokvis-mcp] Fatal:', err);
  process.exit(1);
});

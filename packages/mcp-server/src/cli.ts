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
 */

import { createLokvisMcpServer } from './server.js';

async function main(): Promise<void> {
  const workdir = process.env.LOKVIS_WORKDIR;
  const domains = process.env.LOKVIS_DOMAINS?.split(',').filter(Boolean) as
    | Array<'image' | 'pdf' | 'video' | 'audio' | 'ai'>
    | undefined;
  const mode = (process.env.LOKVIS_MODE as 'stdio' | 'sse' | undefined) ?? 'stdio';

  const { server, manifest } = await createLokvisMcpServer({
    workdir,
    domains,
    mode,
  });

  console.error(`[lokvis-mcp] Manifest ready: ${manifest.tools.length} tools`);
  console.error(`[lokvis-mcp] Registered tools: ${server.getRegisteredToolNames().join(', ')}`);
  console.error(`[lokvis-mcp] Starting server (mode: ${mode})...`);

  // stdio 模式:启动后阻塞直到 stdin 关闭(客户端断开)
  if (mode === 'stdio') {
    await server.start();
    console.error('[lokvis-mcp] Server stopped');
  } else {
    console.error(`[lokvis-mcp] SSE mode not yet implemented (M2.3)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[lokvis-mcp] Fatal:', err);
  process.exit(1);
});

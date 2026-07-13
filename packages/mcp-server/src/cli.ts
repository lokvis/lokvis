#!/usr/bin/env node
/**
 * lokvis-mcp CLI 入口。
 *
 * 由 `npx @lokvis/mcp-server` 调用,启动 MCP server。
 *
 * 环境变量:
 *   LOKVIS_WORKDIR     - 工作目录(Node 模式资产读写根路径)
 *   LOKVIS_DOMAINS     - 启用的能力域,逗号分隔(默认 'image')
 *   LOKVIS_MODE        - 运行模式 'stdio'(默认) | 'sse'
 *   LOKVIS_PORT        - SSE 模式监听端口(默认 3001)
 *   LOKVIS_BRIDGE_PORT - BrowserBridge 端口(混合架构 E,浏览器可连接接管 tool 调用)
 */

import { createLokvisMcpServer } from './server.js';

async function main(): Promise<void> {
  const workdir = process.env.LOKVIS_WORKDIR;
  const domains = process.env.LOKVIS_DOMAINS?.split(',').filter(Boolean) as
    | Array<'image' | 'pdf' | 'video' | 'audio' | 'ai'>
    | undefined;
  const mode = (process.env.LOKVIS_MODE as 'stdio' | 'sse' | undefined) ?? 'stdio';
  const port = Number(process.env.LOKVIS_PORT ?? 3001);
  const bridgePortEnv = process.env.LOKVIS_BRIDGE_PORT;
  const bridgePort = bridgePortEnv ? Number(bridgePortEnv) : undefined;

  const { server, manifest, bridge } = await createLokvisMcpServer({
    workdir,
    domains,
    mode,
    port,
    bridgePort,
  });

  console.error(`[lokvis-mcp] Manifest ready: ${manifest.tools.length} tools`);
  console.error(`[lokvis-mcp] Registered tools: ${server.getRegisteredToolNames().join(', ')}`);
  if (bridgePort !== undefined) {
    console.error(`[lokvis-mcp] BrowserBridge listening on ws://127.0.0.1:${bridgePort}`);
  }
  console.error(`[lokvis-mcp] Starting server (mode: ${mode})...`);

  // 优雅关闭:收到 SIGINT/SIGTERM 时关闭所有资源
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[lokvis-mcp] Received ${signal}, shutting down...`);
    await bridge.close().catch(() => {});
    await server.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  if (mode === 'stdio') {
    // stdio 模式:启动后阻塞直到 stdin 关闭(客户端断开)
    await server.start();
    console.error('[lokvis-mcp] Server stopped');
    await bridge.close().catch(() => {});
  } else if (mode === 'sse') {
    // SSE 模式:HTTP server 监听,Web 客户端经 /sse 连接
    const sse = await server.startSse(port);
    console.error(`[lokvis-mcp] SSE server listening on http://127.0.0.1:${sse.getPort()}/sse`);
    // 不退出:保持 HTTP server 运行,等待关闭信号
  } else {
    console.error(`[lokvis-mcp] Unknown mode: ${mode}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[lokvis-mcp] Fatal:', err);
  process.exit(1);
});

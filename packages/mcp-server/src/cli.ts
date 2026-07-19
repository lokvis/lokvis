#!/usr/bin/env node
/**
 * lokvis-mcp CLI 入口。
 *
 * 由 `npx @lokvis/mcp-server` 调用,启动 MCP server。
 *
 * 环境变量:
 *   LOKVIS_WORKDIR      - 工作目录(Node 模式资产读写根路径)
 *   LOKVIS_DOMAINS      - 启用的能力域,逗号分隔(默认 'image,pdf')
 *   LOKVIS_MODE         - 运行模式 'stdio'(默认) | 'sse'
 *   LOKVIS_PORT         - SSE 模式监听端口(默认 3001)
 *   LOKVIS_BRIDGE_PORT  - BrowserBridge 端口(混合架构 E,浏览器可连接接管 tool 调用)
 *   LOKVIS_API_KEY      - API Key(可选;未提供时仅本地 tool 可用,cloud AI tool 不可用)
 *   LOKVIS_API_BASE_URL - cloud API 地址(默认 https://api.lokvis.com)
 *   LOKVIS_UPGRADE_URL  - 充值链接(默认 https://app.lokvis.com/billing)
 *   LOKVIS_PLAN_QUOTAS_JSON - plan 配额表 JSON(默认内置 free/pro/cloud_pro/enterprise)
 *   LOKVIS_PRICE_PER_CALL_CENTS - 每次 AI 调用价格美分(默认 1)
 *
 * SSE 模式专属(Phase 3 M1):
 *   LOKVIS_SSE_MAX_CONNECTIONS - 最大并发会话数(默认 10)
 *   LOKVIS_SSE_CORS_ORIGINS    - 允许跨域的 Origin 白名单,逗号分隔(默认空,不允许跨域)
 *   LOKVIS_SSE_AUTH_TOKEN      - SSE 鉴权 token(默认回退到 LOKVIS_API_KEY;未设置时跳过鉴权)
 *   LOKVIS_SSE_HEARTBEAT_MS    - 心跳间隔毫秒(默认 15000,设 0 禁用)
 */

import { createLokvisMcpServer } from './server.js';
import { resolveCloudConfig } from '@lokvis/cloud-bridge';
import type { LokvisSseServer } from './sse-transport.js';

async function main(): Promise<void> {
  const workdir = process.env.LOKVIS_WORKDIR;
  const domains = process.env.LOKVIS_DOMAINS?.split(',').filter(Boolean) as
    | Array<'image' | 'pdf' | 'video' | 'audio' | 'ai'>
    | undefined;
  const mode = (process.env.LOKVIS_MODE as 'stdio' | 'sse' | undefined) ?? 'stdio';
  const port = Number(process.env.LOKVIS_PORT ?? 3001);
  const bridgePortEnv = process.env.LOKVIS_BRIDGE_PORT;
  const bridgePort = bridgePortEnv ? Number(bridgePortEnv) : undefined;

  // SSE 模式选项(Phase 3 M1 硬化)
  const sseMaxConnections = Number(process.env.LOKVIS_SSE_MAX_CONNECTIONS ?? 10);
  const sseCorsOrigins = process.env.LOKVIS_SSE_CORS_ORIGINS
    ? process.env.LOKVIS_SSE_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  // authToken 默认回退到 LOKVIS_API_KEY(若存在);两者都未设置时为 undefined(跳过鉴权)
  const sseAuthToken =
    process.env.LOKVIS_SSE_AUTH_TOKEN ?? process.env.LOKVIS_API_KEY ?? undefined;
  const sseHeartbeatMs = Number(process.env.LOKVIS_SSE_HEARTBEAT_MS ?? 15000);

  // cloud 配置从 env 读取(apiBaseUrl / upgradeUrl / planQuotas / pricePerCallCents / apiKey)
  // 注入 createLokvisMcpServer 后,server 侧创建 authenticator + billing:
  // - authenticator 用于启动时验证 API Key(下方日志)
  // - billing 在 Phase 2 cloud AI tool 接入时由 tool handler 消费
  const cloudConfig = resolveCloudConfig();

  const { server, manifest, bridge, authenticator } = await createLokvisMcpServer({
    workdir,
    domains,
    mode,
    port,
    bridgePort,
    cloud: cloudConfig,
  });

  // 启动时验证 API Key(如果提供)
  if (authenticator?.hasApiKey()) {
    const authResult = await authenticator.verify();
    if (authResult.authenticated) {
      console.error(`[lokvis-mcp] Authenticated as ${authResult.user!.email} (plan: ${authResult.user!.plan})`);
    } else {
      console.error(`[lokvis-mcp] API key validation failed: ${authResult.error}`);
      console.error('[lokvis-mcp] Running in local-only mode (cloud AI tools disabled)');
    }
  } else {
    console.error('[lokvis-mcp] No API key provided, running in local-only mode');
  }

  console.error(`[lokvis-mcp] Manifest ready: ${manifest.tools.length} tools`);
  console.error(`[lokvis-mcp] Registered tools: ${server.getRegisteredToolNames().join(', ')}`);
  if (bridgePort !== undefined) {
    console.error(`[lokvis-mcp] BrowserBridge listening on ws://127.0.0.1:${bridgePort}`);
  }
  console.error(`[lokvis-mcp] Starting server (mode: ${mode})...`);

  // SSE server 引用(仅 mode='sse' 时赋值);shutdown 时需要关闭它
  let sse: LokvisSseServer | undefined;

  // 优雅关闭:收到 SIGINT/SIGTERM 时关闭所有资源
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[lokvis-mcp] Received ${signal}, shutting down...`);
    if (sse) {
      await sse.close().catch((err) => console.warn('[lokvis-mcp] SSE close failed:', err));
    }
    await bridge.close().catch((err) => console.warn('[lokvis-mcp] bridge close failed:', err));
    await server.close().catch((err) => console.warn('[lokvis-mcp] server close failed:', err));
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  if (mode === 'stdio') {
    // stdio 模式:启动后阻塞直到 stdin 关闭(客户端断开)
    await server.start();
    console.error('[lokvis-mcp] Server stopped');
    await bridge.close().catch((err) => console.warn('[lokvis-mcp] bridge close failed:', err));
  } else if (mode === 'sse') {
    // SSE 模式:HTTP server 监听,Web 客户端经 /sse 连接
    sse = await server.startSse(port, {
      maxConnections: sseMaxConnections,
      corsOrigins: sseCorsOrigins,
      authToken: sseAuthToken,
      heartbeatIntervalMs: sseHeartbeatMs,
    });
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

/**
 * LokvisSseServer 集成测试(M2.3)。
 *
 * 用 SDK 真实 Client + SSEClientTransport 连接 LokvisSseServer,
 * 验证 SSE 传输的端到端 JSON-RPC 往返:listTools / callTool。
 *
 * 浏览器 API 不涉及;SSE/HTTP 均为 Node 原生,使用真实网络回环。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { LokvisSseServer } from '../sse-transport.js';

/** 记录待关闭资源,测试结束统一清理 */
const servers: LokvisSseServer[] = [];
const clients: Client[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) {
    await c.close().catch((err) => {
      console.warn('[mcp-server test] SSE client close failed:', err);
    });
  }
  for (const s of servers.splice(0)) {
    await s.close().catch((err) => {
      console.warn('[mcp-server test] SSE server close failed:', err);
    });
  }
});

/** 构造一个注册了 echo tool 的 SDK Server */
function makeEchoServer(): Server {
  const server = new Server(
    { name: 'lokvis-test', version: '0.0.0' },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'echo',
        description: '回显输入',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
        },
      },
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req): Promise<any> => {
    const { name, arguments: args } = req.params;
    if (name === 'echo') {
      return {
        content: [{ type: 'text', text: String(args?.message ?? '') }],
      };
    }
    return { content: [{ type: 'text', text: `unknown: ${name}` }], isError: true };
  });
  return server;
}

describe('LokvisSseServer', () => {
  it('start 后应在指定端口监听,并可通过 SSEClientTransport 完成初始化握手', async () => {
    const sdkServer = makeEchoServer();
    const sse = new LokvisSseServer(sdkServer, { port: 0 });
    servers.push(sse);
    await sse.start();

    const port = sse.getPort();
    expect(port).toBeDefined();
    expect(port!).toBeGreaterThan(0);

    const client = new Client(
      { name: 'test-client', version: '0.0.0' },
      { capabilities: {} }
    );
    clients.push(client);
    const transport = new SSEClientTransport(
      new URL(`http://127.0.0.1:${port}/sse`)
    );
    await client.connect(transport);

    expect(sse.hasActiveSession()).toBe(true);
  });

  it('listTools 应返回已注册的 tool', async () => {
    const sdkServer = makeEchoServer();
    const sse = new LokvisSseServer(sdkServer, { port: 0 });
    servers.push(sse);
    await sse.start();

    const client = new Client(
      { name: 'test-client', version: '0.0.0' },
      { capabilities: {} }
    );
    clients.push(client);
    await client.connect(
      new SSEClientTransport(new URL(`http://127.0.0.1:${sse.getPort()}/sse`))
    );

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe('echo');
    expect(tools[0]!.description).toBe('回显输入');
  });

  it('callTool 应通过 SSE 往返返回 echo 结果', async () => {
    const sdkServer = makeEchoServer();
    const sse = new LokvisSseServer(sdkServer, { port: 0 });
    servers.push(sse);
    await sse.start();

    const client = new Client(
      { name: 'test-client', version: '0.0.0' },
      { capabilities: {} }
    );
    clients.push(client);
    await client.connect(
      new SSEClientTransport(new URL(`http://127.0.0.1:${sse.getPort()}/sse`))
    );

    const result = await client.callTool({ name: 'echo', arguments: { message: 'hello-mcp' } });
    expect(result.content).toEqual([{ type: 'text', text: 'hello-mcp' }]);
    expect(result.isError).toBeFalsy();
  });

  it('未建立 SSE 会话时 POST /messages 应返回 400', async () => {
    const sdkServer = makeEchoServer();
    const sse = new LokvisSseServer(sdkServer, { port: 0 });
    servers.push(sse);
    await sse.start();

    const resp = await fetch(`http://127.0.0.1:${sse.getPort()}/messages`, {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(resp.status).toBe(400);
  });

  it('未知路径应返回 404', async () => {
    const sdkServer = makeEchoServer();
    const sse = new LokvisSseServer(sdkServer, { port: 0 });
    servers.push(sse);
    await sse.start();

    const resp = await fetch(`http://127.0.0.1:${sse.getPort()}/unknown`);
    expect(resp.status).toBe(404);
  });

  it('close 后端口不再可连', async () => {
    const sdkServer = makeEchoServer();
    const sse = new LokvisSseServer(sdkServer, { port: 0 });
    await sse.start();
    const port = sse.getPort();
    await sse.close();

    expect(sse.hasActiveSession()).toBe(false);
    // 关闭后连接应失败(ECONNREFUSED)
    await expect(
      fetch(`http://127.0.0.1:${port}/sse`).catch((e) => {
        throw e;
      })
    ).rejects.toThrow();
  });

  // ─── Phase 3 M1 硬化:多会话 / CORS / 鉴权 / 心跳 / 断开检测 ───

  it('多会话并发:两个 SSEClientTransport 同时连接,各自 callTool 不串扰', async () => {
    // 使用 server 工厂:每个连接创建独立 Server 实例(SDK Server 一次只能 connect 一个 transport)
    const sse = new LokvisSseServer(() => makeEchoServer(), {
      port: 0,
      maxConnections: 10,
    });
    servers.push(sse);
    await sse.start();

    const client1 = new Client(
      { name: 'c1', version: '0.0.0' },
      { capabilities: {} }
    );
    const client2 = new Client(
      { name: 'c2', version: '0.0.0' },
      { capabilities: {} }
    );
    clients.push(client1, client2);

    await client1.connect(
      new SSEClientTransport(new URL(`http://127.0.0.1:${sse.getPort()}/sse`))
    );
    await client2.connect(
      new SSEClientTransport(new URL(`http://127.0.0.1:${sse.getPort()}/sse`))
    );

    expect(sse.getActiveSessionCount()).toBe(2);

    // 并发 callTool,验证结果不串扰
    const [r1, r2] = await Promise.all([
      client1.callTool({ name: 'echo', arguments: { message: 'client1' } }),
      client2.callTool({ name: 'echo', arguments: { message: 'client2' } }),
    ]);

    expect(r1.content).toEqual([{ type: 'text', text: 'client1' }]);
    expect(r2.content).toEqual([{ type: 'text', text: 'client2' }]);
  });

  it('客户端断开:fetch abort 后 hasActiveSession() 为 false', async () => {
    const sse = new LokvisSseServer(() => makeEchoServer(), { port: 0 });
    servers.push(sse);
    await sse.start();

    const controller = new AbortController();
    const resp = await fetch(`http://127.0.0.1:${sse.getPort()}/sse`, {
      signal: controller.signal,
    });

    // 读取首个数据块(endpoint 事件)以确保 session 已建立
    const reader = resp.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('endpoint');

    expect(sse.hasActiveSession()).toBe(true);

    // 中断连接,触发服务端 res.on('close')
    controller.abort();

    // 轮询等待服务端检测到断开(res.on('close') 异步触发)
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const check = () => {
        if (!sse.hasActiveSession() || Date.now() - start > 1000) {
          resolve();
        } else {
          setTimeout(check, 20);
        }
      };
      check();
    });

    expect(sse.hasActiveSession()).toBe(false);

    // 清理 reader(abort 后可能抛错)
    try {
      await reader.cancel();
    } catch (err) {
      console.warn('[mcp-server test] reader cancel failed:', err);
    }
  });

  it('CORS 预检:OPTIONS 请求返回正确头 + 204', async () => {
    const sse = new LokvisSseServer(() => makeEchoServer(), {
      port: 0,
      corsOrigins: ['http://example.com'],
    });
    servers.push(sse);
    await sse.start();

    const resp = await fetch(`http://127.0.0.1:${sse.getPort()}/sse`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com' },
    });

    expect(resp.status).toBe(204);
    expect(resp.headers.get('access-control-allow-origin')).toBe('http://example.com');
    expect(resp.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(resp.headers.get('access-control-allow-headers')).toContain('X-Session-Id');
    expect(resp.headers.get('access-control-allow-methods')).toContain('GET');
    expect(resp.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('CORS 拒绝:白名单外 Origin 返回 403', async () => {
    const sse = new LokvisSseServer(() => makeEchoServer(), {
      port: 0,
      corsOrigins: ['http://example.com'],
    });
    servers.push(sse);
    await sse.start();

    const resp = await fetch(`http://127.0.0.1:${sse.getPort()}/sse`, {
      headers: { Origin: 'http://evil.com' },
    });

    expect(resp.status).toBe(403);
  });

  it('鉴权失败:无 token / 错 token 返回 401', async () => {
    const sse = new LokvisSseServer(() => makeEchoServer(), {
      port: 0,
      authToken: 'secret-token',
    });
    servers.push(sse);
    await sse.start();

    // 无 Authorization 头
    const resp1 = await fetch(`http://127.0.0.1:${sse.getPort()}/sse`);
    expect(resp1.status).toBe(401);

    // 错误 token
    const resp2 = await fetch(`http://127.0.0.1:${sse.getPort()}/sse`, {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(resp2.status).toBe(401);

    // POST 端点同样校验
    const resp3 = await fetch(
      `http://127.0.0.1:${sse.getPort()}/messages?sessionId=nonexistent`,
      {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json' },
      }
    );
    expect(resp3.status).toBe(401);
  });

  it('鉴权成功:正确 Bearer token 可正常 callTool', async () => {
    const sse = new LokvisSseServer(() => makeEchoServer(), {
      port: 0,
      authToken: 'secret-token',
    });
    servers.push(sse);
    await sse.start();

    // SSEClientTransport 通过 requestInit.headers 携带 Authorization
    // SDK 内部 _commonHeaders() 会把 requestInit.headers 合并到 GET 与 POST 请求
    const client = new Client(
      { name: 'authed-client', version: '0.0.0' },
      { capabilities: {} }
    );
    clients.push(client);
    const transport = new SSEClientTransport(
      new URL(`http://127.0.0.1:${sse.getPort()}/sse`),
      {
        requestInit: {
          headers: { Authorization: 'Bearer secret-token' },
        },
      }
    );
    await client.connect(transport);

    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'authed' },
    });
    expect(result.content).toEqual([{ type: 'text', text: 'authed' }]);
    expect(result.isError).toBeFalsy();
  });

  it('maxConnections 限制:超限返回 503', async () => {
    const sse = new LokvisSseServer(() => makeEchoServer(), {
      port: 0,
      maxConnections: 1,
    });
    servers.push(sse);
    await sse.start();

    // 第一个客户端连接(占用唯一名额)
    const client1 = new Client(
      { name: 'c1', version: '0.0.0' },
      { capabilities: {} }
    );
    clients.push(client1);
    await client1.connect(
      new SSEClientTransport(new URL(`http://127.0.0.1:${sse.getPort()}/sse`))
    );
    expect(sse.getActiveSessionCount()).toBe(1);

    // 第二个连接应被拒绝(503)
    const resp = await fetch(`http://127.0.0.1:${sse.getPort()}/sse`);
    expect(resp.status).toBe(503);

    // 响应体可读完后释放
    await resp.text().catch((err) => {
      console.warn('[mcp-server test] response text failed:', err);
    });
  });

  it('心跳:连接空闲后客户端收到 : ping', async () => {
    const sse = new LokvisSseServer(() => makeEchoServer(), {
      port: 0,
      heartbeatIntervalMs: 500,
    });
    servers.push(sse);
    await sse.start();

    // 用原生 fetch + ReadableStream 读取 SSE 流(EventSource 会吞掉注释行)
    const resp = await fetch(`http://127.0.0.1:${sse.getPort()}/sse`);
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();

    let receivedPing = false;
    let receivedEndpoint = false;
    const startTime = Date.now();

    while (Date.now() - startTime < 2000) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text.includes('event: endpoint')) {
        receivedEndpoint = true;
      }
      if (text.includes(': ping')) {
        receivedPing = true;
        break;
      }
    }

    try {
      await reader.cancel();
    } catch (err) {
      console.warn('[mcp-server test] reader cancel failed:', err);
    }

    expect(receivedEndpoint).toBe(true);
    expect(receivedPing).toBe(true);
  });
});

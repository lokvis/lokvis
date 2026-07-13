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
    await c.close().catch(() => {});
  }
  for (const s of servers.splice(0)) {
    await s.close().catch(() => {});
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
});

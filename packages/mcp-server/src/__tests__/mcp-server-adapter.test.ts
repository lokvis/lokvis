/**
 * McpServerAdapter 单元测试
 *
 * 使用 mock transport 模拟客户端请求,验证:
 * 1. registerTool / registerResource / registerPrompt 注册后能通过 list RPC 返回
 * 2. CallTool handler 查找 tool 并调用 handler
 * 3. CallTool tool 不存在时返回 isError
 * 4. CallTool handler 抛错时返回 isError
 * 5. ReadResource / GetPrompt 路径
 * 6. start / close 调用 transport
 *
 * 不启动真实 stdio(避免阻塞),用 transportFactory 注入 mock。
 * 等待策略为确定性等待:`transport.request()` 在 server 经 send() 发回同 id 响应时
 * resolve,不使用 setTimeout 固定延时。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { McpServerAdapter } from '../mcp-server-adapter.js';

/** 测试用 JSON-RPC 响应判别联合(result 成功 vs error 失败) */
interface JsonRpcSuccess<T> {
  jsonrpc: '2.0';
  id: number | string | null;
  result: T;
}
interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: number | string | null;
  error: { code: number; message: string; data?: unknown };
}
type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

/** 常用 result 形状(仅覆盖测试断言所需字段) */
interface ToolsListResult {
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
}
interface CallToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}
interface ResourcesListResult {
  resources: Array<{ uri: string; name: string }>;
}
interface ResourceReadResult {
  contents: Array<{ uri: string; mimeType?: string; text?: string }>;
}
interface PromptsListResult {
  prompts: Array<{
    name: string;
    description?: string;
    arguments?: Array<{ name: string; description?: string; required?: boolean }>;
  }>;
}
interface PromptGetResult {
  messages: Array<{ role: string; content: { type: string; text?: string } }>;
}

/** 断言响应为 result 变体,否则抛错(测试失败信息更清晰) */
function asSuccess<T>(resp: JsonRpcResponse<T>): JsonRpcSuccess<T> {
  if ('result' in resp) return resp;
  throw new Error(`期望 result 响应,实际为 error: ${resp.error.message}`);
}

/** 断言响应为 error 变体 */
function asError(resp: JsonRpcResponse<unknown>): JsonRpcFailure {
  if ('error' in resp) return resp;
  throw new Error('期望 error 响应,实际为 result 响应');
}

interface MockExtras {
  /** 模拟客户端发送请求,返回同 id 响应到达时的 Promise(确定性等待) */
  request<T>(msg: JSONRPCRequest): Promise<JsonRpcResponse<T>>;
  /** 已发送的消息(供测试断言) */
  sentMessages: JSONRPCMessage[];
}

/** mock transport:捕获 onmessage 回调,send 时按 id 唤醒等待中的 request() */
function createMockTransport(): Transport & MockExtras {
  let onmessageCb: Transport['onmessage'];
  const sentMessages: JSONRPCMessage[] = [];
  const pending = new Map<number | string, (resp: JsonRpcResponse<unknown>) => void>();

  return {
    start: vi.fn(async () => {}),
    send: vi.fn(async (msg: JSONRPCMessage) => {
      sentMessages.push(msg);
      if ('id' in msg && msg.id !== null && msg.id !== undefined) {
        const resolve = pending.get(msg.id);
        if (resolve) {
          pending.delete(msg.id);
          resolve(msg as JsonRpcResponse<unknown>);
        }
      }
    }),
    close: vi.fn(async () => {}),
    get onmessage() {
      return onmessageCb;
    },
    set onmessage(fn: Transport['onmessage']) {
      onmessageCb = fn;
    },
    request<T>(msg: JSONRPCRequest): Promise<JsonRpcResponse<T>> {
      return new Promise<JsonRpcResponse<T>>((resolve) => {
        pending.set(msg.id, (resp) => resolve(resp as JsonRpcResponse<T>));
        onmessageCb?.(msg);
      });
    },
    sentMessages,
  };
}

/** 从已发送消息中按 id 查找响应(补充断言用) */
function findResponse<T>(messages: JSONRPCMessage[], id: number | string): JsonRpcResponse<T> {
  const msg = messages.find((m) => 'id' in m && m.id === id);
  expect(msg, `应找到 id=${id} 的响应消息`).toBeDefined();
  return msg as JsonRpcResponse<T>;
}

/** 构造 JSON-RPC 请求消息 */
function makeRequest(
  id: number | string,
  method: string,
  params: Record<string, unknown> = {}
): JSONRPCRequest {
  return { jsonrpc: '2.0', id, method, params };
}

describe('McpServerAdapter', () => {
  let adapter: McpServerAdapter;
  let transport: Transport & MockExtras;

  beforeEach(() => {
    transport = createMockTransport();
    adapter = new McpServerAdapter('lokvis-test', '0.0.1', () => transport);
  });

  describe('registerTool / getRegisteredToolNames', () => {
    it('应注册 tool 并在 getRegisteredToolNames 中返回', () => {
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      adapter.registerTool('lokvis_image_resize', 'Resize image', { type: 'object' }, handler);
      expect(adapter.getRegisteredToolNames()).toEqual(['lokvis_image_resize']);
    });

    it('应支持注册多个 tool', () => {
      adapter.registerTool('a', 'A', {}, vi.fn());
      adapter.registerTool('b', 'B', {}, vi.fn());
      expect(adapter.getRegisteredToolNames()).toEqual(['a', 'b']);
    });

    it('同名 tool 后注册的覆盖先注册的', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      adapter.registerTool('a', 'A1', {}, h1);
      adapter.registerTool('a', 'A2', {}, h2);
      expect(adapter.getRegisteredToolNames()).toEqual(['a']);
    });
  });

  describe('start / close', () => {
    it('start() 应调用 transport.start 并 connect', async () => {
      await adapter.start();
      expect(transport.start).toHaveBeenCalledTimes(1);
    });

    it('start() 使用 transportFactory 提供的 transport', async () => {
      await adapter.start();
      // send 一条消息以确认 transport 已被使用
      expect(transport.start).toHaveBeenCalled();
    });

    it('close() 应调用 server.close(进而调用 transport.close)', async () => {
      await adapter.start();
      await adapter.close();
      // server.close() 会调用 transport.close()
      expect(transport.close).toHaveBeenCalled();
    });
  });

  describe('ListTools RPC', () => {
    it('应返回已注册的 tool 列表(含 name/description/inputSchema)', async () => {
      adapter.registerTool(
        'lokvis_image_resize',
        'Resize image',
        { type: 'object', properties: { width: { type: 'number' } } },
        vi.fn()
      );

      await adapter.start();
      const resp = asSuccess(
        await transport.request<ToolsListResult>(makeRequest(1, 'tools/list'))
      );

      expect(resp.result.tools).toHaveLength(1);
      expect(resp.result.tools[0]).toMatchObject({
        name: 'lokvis_image_resize',
        description: 'Resize image',
      });
      expect(resp.result.tools[0]?.inputSchema).toMatchObject({
        type: 'object',
      });
      // findResponse 辅助亦能从 sentMessages 中找到同一响应
      expect(findResponse(transport.sentMessages, 1)).toBeDefined();
    });

    it('未注册 tool 时返回空数组', async () => {
      await adapter.start();
      const resp = asSuccess(
        await transport.request<ToolsListResult>(makeRequest(1, 'tools/list'))
      );
      expect(resp.result.tools).toEqual([]);
    });
  });

  describe('CallTool RPC', () => {
    it('应查找 tool 并调用 handler,返回 handler 结果', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'success' }],
      });
      adapter.registerTool('lokvis_image_resize', 'Resize', {}, handler);

      await adapter.start();
      const resp = asSuccess(
        await transport.request<CallToolResult>(
          makeRequest(1, 'tools/call', {
            name: 'lokvis_image_resize',
            arguments: { width: 100 },
          })
        )
      );

      expect(handler).toHaveBeenCalledWith({ width: 100 });
      expect(resp.result).toMatchObject({
        content: [{ type: 'text', text: 'success' }],
      });
      expect(resp.result.isError).toBeFalsy();
    });

    it('tool 不存在时返回 isError=true', async () => {
      await adapter.start();
      const resp = asSuccess(
        await transport.request<CallToolResult>(
          makeRequest(1, 'tools/call', {
            name: 'not_exist',
            arguments: {},
          })
        )
      );

      expect(resp.result.isError).toBe(true);
      expect(resp.result.content[0]?.text).toContain('not found');
    });

    it('handler 抛错时返回 isError=true 并包含错误消息', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      adapter.registerTool('lokvis_image_resize', 'Resize', {}, handler);

      await adapter.start();
      const resp = asSuccess(
        await transport.request<CallToolResult>(
          makeRequest(1, 'tools/call', {
            name: 'lokvis_image_resize',
            arguments: {},
          })
        )
      );

      expect(resp.result.isError).toBe(true);
      expect(resp.result.content[0]?.text).toContain('boom');
    });

    it('arguments 缺省时应传空对象给 handler', async () => {
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      adapter.registerTool('a', 'A', {}, handler);

      await adapter.start();
      await transport.request<CallToolResult>(
        makeRequest(1, 'tools/call', {
          name: 'a',
          // 不传 arguments
        })
      );

      expect(handler).toHaveBeenCalledWith({});
    });

    it('handler 抛非 Error 值时也应捕获并返回 isError', async () => {
      const handler = vi.fn().mockRejectedValue('string error');
      adapter.registerTool('a', 'A', {}, handler);

      await adapter.start();
      const resp = asSuccess(
        await transport.request<CallToolResult>(
          makeRequest(1, 'tools/call', { name: 'a', arguments: {} })
        )
      );

      expect(resp.result.isError).toBe(true);
      expect(resp.result.content[0]?.text).toContain('string error');
    });
  });

  describe('ListResources / ReadResource RPC', () => {
    it('应返回已注册的 resource 列表', async () => {
      adapter.registerResource(
        'lokvis://manifest',
        'manifest',
        'Server manifest',
        'application/json',
        vi.fn()
      );

      await adapter.start();
      const resp = asSuccess(
        await transport.request<ResourcesListResult>(makeRequest(1, 'resources/list'))
      );

      expect(resp.result.resources).toHaveLength(1);
      expect(resp.result.resources[0]).toMatchObject({
        uri: 'lokvis://manifest',
        name: 'manifest',
      });
    });

    it('应调用 resource handler 并返回结果', async () => {
      const handler = vi.fn().mockResolvedValue({
        contents: [{ uri: 'lokvis://manifest', mimeType: 'application/json', text: '{}' }],
      });
      adapter.registerResource('lokvis://manifest', 'manifest', 'desc', 'application/json', handler);

      await adapter.start();
      const resp = asSuccess(
        await transport.request<ResourceReadResult>(
          makeRequest(1, 'resources/read', { uri: 'lokvis://manifest' })
        )
      );

      expect(handler).toHaveBeenCalledWith('lokvis://manifest');
      expect(resp.result.contents[0]?.text).toBe('{}');
    });

    it('resource 不存在时应返回错误(JSON-RPC error)', async () => {
      await adapter.start();
      const resp = asError(
        await transport.request(
          makeRequest(1, 'resources/read', { uri: 'lokvis://nope' })
        )
      );

      expect(resp.error.message).toContain('not found');
    });
  });

  describe('ListPrompts / GetPrompt RPC', () => {
    it('应返回已注册的 prompt 列表(无 argumentsSchema 时 arguments 为空)', async () => {
      adapter.registerPrompt('greet', 'Greeting prompt', vi.fn());

      await adapter.start();
      const resp = asSuccess(
        await transport.request<PromptsListResult>(makeRequest(1, 'prompts/list'))
      );

      expect(resp.result.prompts).toHaveLength(1);
      expect(resp.result.prompts[0]).toMatchObject({
        name: 'greet',
        description: 'Greeting prompt',
      });
      expect(resp.result.prompts[0]?.arguments).toEqual([]);
    });

    it('应从 argumentsSchema 生成 arguments 列表', async () => {
      adapter.registerPrompt('greet', 'Greet', vi.fn(), {
        name: { type: 'string', description: 'User name' },
      });

      await adapter.start();
      const resp = asSuccess(
        await transport.request<PromptsListResult>(makeRequest(1, 'prompts/list'))
      );

      const args = resp.result.prompts[0]?.arguments ?? [];
      expect(args).toHaveLength(1);
      expect(args[0]).toMatchObject({
        name: 'name',
        description: 'User name',
        required: true,
      });
    });

    it('应调用 prompt handler 并返回结果', async () => {
      const handler = vi.fn().mockResolvedValue({
        messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }],
      });
      adapter.registerPrompt('greet', 'Greet', handler);

      await adapter.start();
      const resp = asSuccess(
        await transport.request<PromptGetResult>(
          makeRequest(1, 'prompts/get', { name: 'greet', arguments: {} })
        )
      );

      expect(handler).toHaveBeenCalledWith({});
      expect(resp.result.messages[0]?.content.text).toBe('hello');
    });

    it('prompt 不存在时应返回错误', async () => {
      await adapter.start();
      const resp = asError(
        await transport.request(makeRequest(1, 'prompts/get', { name: 'nope' }))
      );

      expect(resp.error).toBeDefined();
    });
  });
});

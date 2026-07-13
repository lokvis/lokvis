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
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { McpServerAdapter } from '../mcp-server-adapter.js';

/** 创建 mock transport:捕获 onmessage 回调,提供 sendRequest 模拟客户端请求 */
interface MockTransport extends Transport {
  start: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onclose?: () => void;
  onerror?: (e: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(msg: T) => void;
}

function createMockTransport(): MockTransport & {
  /** 模拟客户端发送请求,触发 server 的 onmessage 回调 */
  sendRequest(msg: JSONRPCMessage): void;
  /** 已发送的消息(供测试断言) */
  sentMessages: JSONRPCMessage[];
} {
  let onmessageCb: ((msg: JSONRPCMessage) => void) | undefined;
  const sentMessages: JSONRPCMessage[] = [];
  const t: MockTransport & {
    sendRequest: (msg: JSONRPCMessage) => void;
    sentMessages: JSONRPCMessage[];
  } = {
    start: vi.fn().mockResolvedValue(undefined),
    send: vi.fn((msg: JSONRPCMessage) => {
      sentMessages.push(msg);
      return Promise.resolve();
    }),
    close: vi.fn().mockResolvedValue(undefined),
    get onmessage() {
      return onmessageCb as never;
    },
    set onmessage(fn: ((msg: JSONRPCMessage) => void) | undefined) {
      onmessageCb = fn;
    },
    sendRequest(msg: JSONRPCMessage) {
      onmessageCb?.(msg);
    },
    sentMessages,
  };
  return t;
}

/** 构造 JSON-RPC 请求消息 */
function makeRequest(id: number | string, method: string, params: object = {}): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params,
  } as JSONRPCMessage;
}

describe('McpServerAdapter', () => {
  let adapter: McpServerAdapter;
  let transport: ReturnType<typeof createMockTransport>;

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
      transport.sendRequest(
        makeRequest(1, 'tools/list', {})
      );

      // 等待 server 内部异步处理完成(handler 同步返回但仍需 microtask)
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect(response).toBeDefined();
      expect((response as any).result.tools).toHaveLength(1);
      expect((response as any).result.tools[0]).toMatchObject({
        name: 'lokvis_image_resize',
        description: 'Resize image',
      });
      expect((response as any).result.tools[0].inputSchema).toMatchObject({
        type: 'object',
      });
    });

    it('未注册 tool 时返回空数组', async () => {
      await adapter.start();
      transport.sendRequest(makeRequest(1, 'tools/list', {}));
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.tools).toEqual([]);
    });
  });

  describe('CallTool RPC', () => {
    it('应查找 tool 并调用 handler,返回 handler 结果', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'success' }],
      });
      adapter.registerTool('lokvis_image_resize', 'Resize', {}, handler);

      await adapter.start();
      transport.sendRequest(
        makeRequest(1, 'tools/call', {
          name: 'lokvis_image_resize',
          arguments: { width: 100 },
        })
      );
      // 等待 handler 的 Promise resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith({ width: 100 });
      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result).toMatchObject({
        content: [{ type: 'text', text: 'success' }],
      });
      expect((response as any).result.isError).toBeFalsy();
    });

    it('tool 不存在时返回 isError=true', async () => {
      await adapter.start();
      transport.sendRequest(
        makeRequest(1, 'tools/call', {
          name: 'not_exist',
          arguments: {},
        })
      );
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.isError).toBe(true);
      expect((response as any).result.content[0].text).toContain('not found');
    });

    it('handler 抛错时返回 isError=true 并包含错误消息', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      adapter.registerTool('lokvis_image_resize', 'Resize', {}, handler);

      await adapter.start();
      transport.sendRequest(
        makeRequest(1, 'tools/call', {
          name: 'lokvis_image_resize',
          arguments: {},
        })
      );
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.isError).toBe(true);
      expect((response as any).result.content[0].text).toContain('boom');
    });

    it('arguments 缺省时应传空对象给 handler', async () => {
      const handler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
      adapter.registerTool('a', 'A', {}, handler);

      await adapter.start();
      transport.sendRequest(
        makeRequest(1, 'tools/call', {
          name: 'a',
          // 不传 arguments
        })
      );
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith({});
    });

    it('handler 抛非 Error 值时也应捕获并返回 isError', async () => {
      const handler = vi.fn().mockRejectedValue('string error');
      adapter.registerTool('a', 'A', {}, handler);

      await adapter.start();
      transport.sendRequest(
        makeRequest(1, 'tools/call', { name: 'a', arguments: {} })
      );
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.isError).toBe(true);
      expect((response as any).result.content[0].text).toContain('string error');
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
      transport.sendRequest(makeRequest(1, 'resources/list', {}));
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.resources).toHaveLength(1);
      expect((response as any).result.resources[0]).toMatchObject({
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
      transport.sendRequest(
        makeRequest(1, 'resources/read', { uri: 'lokvis://manifest' })
      );
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith('lokvis://manifest');
      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.contents[0].text).toBe('{}');
    });

    it('resource 不存在时应返回错误(JSON-RPC error)', async () => {
      await adapter.start();
      transport.sendRequest(
        makeRequest(1, 'resources/read', { uri: 'lokvis://nope' })
      );
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).error).toBeDefined();
      expect((response as any).error.message).toContain('not found');
    });
  });

  describe('ListPrompts / GetPrompt RPC', () => {
    it('应返回已注册的 prompt 列表(无 argumentsSchema 时 arguments 为空)', async () => {
      adapter.registerPrompt('greet', 'Greeting prompt', vi.fn());

      await adapter.start();
      transport.sendRequest(makeRequest(1, 'prompts/list', {}));
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.prompts).toHaveLength(1);
      expect((response as any).result.prompts[0]).toMatchObject({
        name: 'greet',
        description: 'Greeting prompt',
      });
      expect((response as any).result.prompts[0].arguments).toEqual([]);
    });

    it('应从 argumentsSchema 生成 arguments 列表', async () => {
      adapter.registerPrompt('greet', 'Greet', vi.fn(), {
        name: { type: 'string', description: 'User name' },
      });

      await adapter.start();
      transport.sendRequest(makeRequest(1, 'prompts/list', {}));
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      const args = (response as any).result.prompts[0].arguments;
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
      transport.sendRequest(
        makeRequest(1, 'prompts/get', { name: 'greet', arguments: {} })
      );
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith({});
      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).result.messages[0].content.text).toBe('hello');
    });

    it('prompt 不存在时应返回错误', async () => {
      await adapter.start();
      transport.sendRequest(makeRequest(1, 'prompts/get', { name: 'nope' }));
      await new Promise((r) => setTimeout(r, 10));

      const response = transport.sentMessages.find((m) => (m as any).id === 1);
      expect((response as any).error).toBeDefined();
    });
  });
});

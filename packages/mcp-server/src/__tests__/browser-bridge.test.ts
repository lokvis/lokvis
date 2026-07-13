/**
 * BrowserBridge 集成测试(M2.3)。
 *
 * 用真实 WebSocket 客户端(ws 包)模拟浏览器,验证:
 * - 启动后未连接时 isConnected() 为 false
 * - 浏览器连接后 isConnected() 为 true
 * - callTool 往返:server → browser(call) → browser(result) → resolve
 * - 浏览器返回 error 时 reject
 * - 浏览器未连接时 callTool 立即抛错
 * - 浏览器断开时待处理调用被拒绝
 * - 超时(callTimeoutMs)触发 reject
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { BrowserBridge } from '../browser-bridge.js';

const bridges: BrowserBridge[] = [];
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) {
    s.close();
  }
  for (const b of bridges.splice(0)) {
    await b.close().catch(() => {});
  }
});

/** 连一个"浏览器"到 bridge,返回 socket */
function connectBrowser(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** 在浏览器侧等待一条 call 消息 */
function waitForCall(ws: WebSocket, timeout = 1000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for call')), timeout);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe('BrowserBridge', () => {
  it('start 后未连接时 isConnected 应为 false', async () => {
    const bridge = new BrowserBridge({ port: 0 });
    bridges.push(bridge);
    await bridge.start();
    expect(bridge.isConnected()).toBe(false);
  });

  it('浏览器连接后 isConnected 应为 true', async () => {
    const bridge = new BrowserBridge({ port: 0 });
    bridges.push(bridge);
    await bridge.start();
    const ws = await connectBrowser(bridge.getPort()!);
    sockets.push(ws);

    // 给 bridge 一帧时间处理 connection
    await new Promise((r) => setTimeout(r, 50));
    expect(bridge.isConnected()).toBe(true);
  });

  it('callTool 应把 call 消息发给浏览器,并接收 result 返回', async () => {
    const bridge = new BrowserBridge({ port: 0 });
    bridges.push(bridge);
    await bridge.start();
    const ws = await connectBrowser(bridge.getPort()!);
    sockets.push(ws);

    // 浏览器侧:收到 call 后回 result
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      ws.send(
        JSON.stringify({
          type: 'result',
          id: msg.id,
          result: { content: [{ type: 'text', text: 'from-browser' }] },
        })
      );
    });

    const result = await bridge.callTool('lokvis_image_resize', { width: 100 });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'from-browser' }],
    });
  });

  it('浏览器返回 error 时 callTool 应 reject', async () => {
    const bridge = new BrowserBridge({ port: 0 });
    bridges.push(bridge);
    await bridge.start();
    const ws = await connectBrowser(bridge.getPort()!);
    sockets.push(ws);

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      ws.send(JSON.stringify({ type: 'error', id: msg.id, error: 'browser boom' }));
    });

    await expect(bridge.callTool('lokvis_image_resize', {})).rejects.toThrow(
      'browser boom'
    );
  });

  it('浏览器未连接时 callTool 应立即抛错', async () => {
    const bridge = new BrowserBridge({ port: 0 });
    bridges.push(bridge);
    await bridge.start();
    await expect(bridge.callTool('lokvis_image_resize', {})).rejects.toThrow(
      'Browser not connected'
    );
  });

  it('浏览器断开时待处理调用应被拒绝', async () => {
    const bridge = new BrowserBridge({ port: 0 });
    bridges.push(bridge);
    await bridge.start();
    const ws = await connectBrowser(bridge.getPort()!);
    sockets.push(ws);
    await new Promise((r) => setTimeout(r, 50));

    // 浏览器侧不回复,模拟卡住
    const callPromise = bridge.callTool('lokvis_image_resize', {});
    // 让 call 消息送达后再断开
    await waitForCall(ws);

    ws.close();
    await expect(callPromise).rejects.toThrow('Browser disconnected');
  });

  it('超时(callTimeoutMs)应触发 reject', async () => {
    const bridge = new BrowserBridge({ port: 0, callTimeoutMs: 80 });
    bridges.push(bridge);
    await bridge.start();
    const ws = await connectBrowser(bridge.getPort()!);
    sockets.push(ws);
    // 浏览器侧不回复
    ws.on('message', () => {});

    await expect(bridge.callTool('lokvis_image_resize', {})).rejects.toThrow(
      /timed out after 80ms/
    );
  });

  it('close 后应停止监听,新连接应失败', async () => {
    const bridge = new BrowserBridge({ port: 0 });
    await bridge.start();
    const port = bridge.getPort()!;
    await bridge.close();

    await expect(connectBrowser(port)).rejects.toThrow();
  });
});

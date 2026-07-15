/**
 * Plugin 权限沙箱单元测试(W18.6)
 *
 * 覆盖:
 * - PluginPermissionSandbox 构造 / has() 查询
 * - assertNetworkAllowed / assertFilesystemAllowed 断言
 * - applyNetworkGuard monkey-patch fetch/XHR/WebSocket/EventSource
 * - restore 函数恢复全局 API
 * - 三个错误类的字段
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PluginPermissionSandbox,
  PluginPermissionError,
  NetworkGuardError,
  FilesystemGuardError,
} from '../plugin-permissions.js';
import type { PluginPermission } from '@lokvis/schema';

describe('Plugin 权限沙箱 (W18.6)', () => {
  // ─── 构造与查询 ──────────────────────────────────────
  describe('构造与 has() 查询', () => {
    it('传入权限数组时 declared 包含所有声明', () => {
      const perms: PluginPermission[] = ['asset:read', 'asset:write', 'network:none'];
      const sb = new PluginPermissionSandbox('test-plugin', perms);
      expect(sb.pluginName).toBe('test-plugin');
      expect(sb.has('asset:read')).toBe(true);
      expect(sb.has('asset:write')).toBe(true);
      expect(sb.has('network:none')).toBe(true);
    });

    it('未声明的权限 has() 返回 false', () => {
      const sb = new PluginPermissionSandbox('p', ['asset:read']);
      expect(sb.has('network:full')).toBe(false);
      expect(sb.has('filesystem:opfs')).toBe(false);
    });

    it('permissions 为 undefined 时 declared 为空集', () => {
      const sb = new PluginPermissionSandbox('p', undefined);
      expect(sb.has('asset:read')).toBe(false);
      expect(sb.declared.size).toBe(0);
    });

    it('permissions 为空数组时 declared 为空集', () => {
      const sb = new PluginPermissionSandbox('p', []);
      expect(sb.declared.size).toBe(0);
    });
  });

  // ─── assertNetworkAllowed ────────────────────────────
  describe('assertNetworkAllowed', () => {
    it('声明 network:none 时抛 PluginPermissionError', () => {
      const sb = new PluginPermissionSandbox('netless', ['network:none']);
      expect(() => sb.assertNetworkAllowed('loading model')).toThrow(PluginPermissionError);
      try {
        sb.assertNetworkAllowed('loading model');
      } catch (e) {
        expect(e).toBeInstanceOf(PluginPermissionError);
        const err = e as PluginPermissionError;
        expect(err.pluginName).toBe('netless');
        expect(err.permission).toBe('network:none');
        expect(err.reason).toBe('loading model');
      }
    });

    it('声明 network:limited 时不抛错', () => {
      const sb = new PluginPermissionSandbox('p', ['network:limited']);
      expect(() => sb.assertNetworkAllowed('fetch manifest')).not.toThrow();
    });

    it('声明 network:full 时不抛错', () => {
      const sb = new PluginPermissionSandbox('p', ['network:full']);
      expect(() => sb.assertNetworkAllowed('upload data')).not.toThrow();
    });

    it('未声明任何 network 权限时不抛错(无限制)', () => {
      const sb = new PluginPermissionSandbox('p', ['asset:read']);
      expect(() => sb.assertNetworkAllowed('anything')).not.toThrow();
    });
  });

  // ─── assertFilesystemAllowed ─────────────────────────
  describe('assertFilesystemAllowed', () => {
    it('声明 filesystem:opfs 时 opfs scope 允许', () => {
      const sb = new PluginPermissionSandbox('p', ['filesystem:opfs']);
      expect(() => sb.assertFilesystemAllowed('opfs', 'write cache')).not.toThrow();
    });

    it('未声明 filesystem:opfs 时 opfs scope 抛错', () => {
      const sb = new PluginPermissionSandbox('p', ['asset:read']);
      expect(() => sb.assertFilesystemAllowed('opfs', 'write cache')).toThrow(PluginPermissionError);
      try {
        sb.assertFilesystemAllowed('opfs', 'write cache');
      } catch (e) {
        const err = e as PluginPermissionError;
        expect(err.permission).toBe('filesystem:opfs');
      }
    });

    it('声明 filesystem:local 时 local scope 允许', () => {
      const sb = new PluginPermissionSandbox('p', ['filesystem:local']);
      expect(() => sb.assertFilesystemAllowed('local', 'read user file')).not.toThrow();
    });

    it('仅声明 filesystem:opfs 时 local scope 仍抛错(local 是更宽权限)', () => {
      const sb = new PluginPermissionSandbox('p', ['filesystem:opfs']);
      expect(() => sb.assertFilesystemAllowed('local', 'read user file')).toThrow(PluginPermissionError);
    });

    it('错误类包含 scope 字段', () => {
      const sb = new PluginPermissionSandbox('p', []);
      try {
        sb.assertFilesystemAllowed('local', 'test');
      } catch (e) {
        expect(e).toBeInstanceOf(PluginPermissionError);
        // assertFilesystemAllowed 抛 PluginPermissionError(非 FilesystemGuardError)
        const err = e as PluginPermissionError;
        expect(err.permission).toBe('filesystem:local');
      }
    });
  });

  // ─── applyNetworkGuard: 非限制插件 ───────────────────
  describe('applyNetworkGuard (非限制插件)', () => {
    it('声明 network:limited 时返回 no-op restore,不 patch 全局 API', () => {
      const sb = new PluginPermissionSandbox('p', ['network:limited']);
      const origFetch = globalThis.fetch;
      const restore = sb.applyNetworkGuard();
      expect(globalThis.fetch).toBe(origFetch); // 未被替换
      restore();
      expect(globalThis.fetch).toBe(origFetch);
    });

    it('未声明 network 权限时返回 no-op restore', () => {
      const sb = new PluginPermissionSandbox('p', ['asset:read']);
      const restore = sb.applyNetworkGuard();
      restore(); // 不抛错即可
    });
  });

  // ─── applyNetworkGuard: network:none 限制插件 ────────
  describe('applyNetworkGuard (network:none)', () => {
    let restore: (() => void) | undefined;
    let origFetch: typeof globalThis.fetch;
    // 保存可能不存在的浏览器 API 引用(Node 测试环境需注入 fake)
    let hadXHR: boolean;
    let hadWS: boolean;
    let hadES: boolean;
    let origXHR: typeof XMLHttpRequest | undefined;
    let origWebSocket: typeof WebSocket | undefined;
    let origEventSource: typeof EventSource | undefined;

    beforeEach(() => {
      origFetch = globalThis.fetch;
      hadXHR = typeof globalThis.XMLHttpRequest !== 'undefined';
      hadWS = typeof globalThis.WebSocket !== 'undefined';
      hadES = typeof globalThis.EventSource !== 'undefined';
      origXHR = globalThis.XMLHttpRequest;
      origWebSocket = globalThis.WebSocket;
      origEventSource = globalThis.EventSource;

      // 注入 fake 浏览器 API(Node 环境无 XMLHttpRequest/WebSocket/EventSource)
      if (!hadXHR) {
        class FakeXHR {
          static UNSENT = 0;
          static OPENED = 1;
          static HEADERS_RECEIVED = 2;
          static LOADING = 3;
          static DONE = 4;
          open() {}
          send() {}
        }
        globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
      }
      if (!hadWS) {
        class FakeWS {
          static CLOSED = 0;
          static CLOSING = 1;
          static CONNECTING = 2;
          static OPEN = 3;
        }
        globalThis.WebSocket = FakeWS as unknown as typeof WebSocket;
      }
      if (!hadES) {
        class FakeES {}
        globalThis.EventSource = FakeES as unknown as typeof EventSource;
      }
    });

    afterEach(() => {
      if (restore) {
        restore();
        restore = undefined;
      }
      // 恢复原始环境(移除注入的 fake)
      if (!hadXHR) delete (globalThis as Record<string, unknown>).XMLHttpRequest;
      else globalThis.XMLHttpRequest = origXHR!;
      if (!hadWS) delete (globalThis as Record<string, unknown>).WebSocket;
      else globalThis.WebSocket = origWebSocket!;
      if (!hadES) delete (globalThis as Record<string, unknown>).EventSource;
      else globalThis.EventSource = origEventSource!;
    });

    it('声明 network:none 时 fetch 调用抛 NetworkGuardError', () => {
      const sb = new PluginPermissionSandbox('netless', ['network:none']);
      restore = sb.applyNetworkGuard();
      expect(() => fetch('https://example.com')).toThrow(NetworkGuardError);
      try {
        fetch('https://example.com');
      } catch (e) {
        const err = e as NetworkGuardError;
        expect(err.pluginName).toBe('netless');
        expect(err.api).toBe('fetch');
      }
    });

    it('声明 network:none 时 XMLHttpRequest.open 抛 NetworkGuardError', () => {
      const sb = new PluginPermissionSandbox('netless', ['network:none']);
      restore = sb.applyNetworkGuard();
      const xhr = new XMLHttpRequest();
      expect(() => xhr.open('GET', 'https://example.com')).toThrow(NetworkGuardError);
      try {
        xhr.open('GET', 'https://example.com');
      } catch (e) {
        expect((e as NetworkGuardError).api).toBe('XMLHttpRequest.open');
      }
    });

    it('声明 network:none 时 new WebSocket() 抛 NetworkGuardError', () => {
      const sb = new PluginPermissionSandbox('netless', ['network:none']);
      restore = sb.applyNetworkGuard();
      expect(() => new WebSocket('wss://example.com')).toThrow(NetworkGuardError);
      try {
        new WebSocket('wss://example.com');
      } catch (e) {
        expect((e as NetworkGuardError).api).toBe('WebSocket');
      }
    });

    it('声明 network:none 时 new EventSource() 抛 NetworkGuardError', () => {
      const sb = new PluginPermissionSandbox('netless', ['network:none']);
      restore = sb.applyNetworkGuard();
      expect(() => new EventSource('https://example.com/stream')).toThrow(NetworkGuardError);
      try {
        new EventSource('https://example.com/stream');
      } catch (e) {
        expect((e as NetworkGuardError).api).toBe('EventSource');
      }
    });

    it('restore 后全局 API 恢复原实现', () => {
      const sb = new PluginPermissionSandbox('netless', ['network:none']);
      const beforeFetch = globalThis.fetch;
      const beforeXHRopen = globalThis.XMLHttpRequest.prototype.open;
      const beforeWS = globalThis.WebSocket;
      const beforeES = globalThis.EventSource;
      restore = sb.applyNetworkGuard();
      expect(globalThis.fetch).not.toBe(beforeFetch); // 已被 patch
      restore();
      restore = undefined;
      expect(globalThis.fetch).toBe(beforeFetch);
      expect(globalThis.XMLHttpRequest.prototype.open).toBe(beforeXHRopen);
      expect(globalThis.WebSocket).toBe(beforeWS);
      expect(globalThis.EventSource).toBe(beforeES);
    });

    it('多次 applyNetworkGuard + restore 嵌套调用正确恢复', () => {
      const sb = new PluginPermissionSandbox('netless', ['network:none']);
      const r1 = sb.applyNetworkGuard();
      const r2 = sb.applyNetworkGuard();
      expect(() => fetch('https://x.com')).toThrow(NetworkGuardError);
      r2();
      // r1 仍生效(外层守卫未恢复)
      expect(() => fetch('https://x.com')).toThrow(NetworkGuardError);
      r1();
      expect(globalThis.fetch).toBe(origFetch);
    });
  });

  // ─── 错误类字段 ──────────────────────────────────────
  describe('错误类', () => {
    it('PluginPermissionError 包含 pluginName / permission / reason', () => {
      const err = new PluginPermissionError('myplugin', 'network:none', 'test reason');
      expect(err.name).toBe('PluginPermissionError');
      expect(err.pluginName).toBe('myplugin');
      expect(err.permission).toBe('network:none');
      expect(err.reason).toBe('test reason');
      expect(err.message).toContain('myplugin');
      expect(err.message).toContain('network:none');
      expect(err.message).toContain('test reason');
      expect(err instanceof Error).toBe(true);
    });

    it('NetworkGuardError 包含 pluginName / api', () => {
      const err = new NetworkGuardError('netless', 'fetch');
      expect(err.name).toBe('NetworkGuardError');
      expect(err.pluginName).toBe('netless');
      expect(err.api).toBe('fetch');
      expect(err.message).toContain('network:none');
      expect(err.message).toContain('fetch');
      expect(err instanceof Error).toBe(true);
    });

    it('FilesystemGuardError 包含 pluginName / scope', () => {
      const err = new FilesystemGuardError('fsp', 'opfs');
      expect(err.name).toBe('FilesystemGuardError');
      expect(err.pluginName).toBe('fsp');
      expect(err.scope).toBe('opfs');
      expect(err.message).toContain('filesystem:opfs');
      expect(err instanceof Error).toBe(true);
    });
  });

  // ─── implements 接口 ─────────────────────────────────
  describe('schema 接口实现', () => {
    it('PluginPermissionSandbox 实现 PluginPermissionSandbox 接口', () => {
      const sb = new PluginPermissionSandbox('p', ['asset:read']);
      // 接口字段
      expect(typeof sb.pluginName).toBe('string');
      expect(sb.declared).toBeInstanceOf(Set);
      // 接口方法
      expect(typeof sb.has).toBe('function');
      expect(typeof sb.assertNetworkAllowed).toBe('function');
      expect(typeof sb.assertFilesystemAllowed).toBe('function');
    });
  });
});

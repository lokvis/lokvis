/**
 * Plugin 权限沙箱(W18.6)
 *
 * 据插件 PluginConfig.permissions 声明提供:
 * 1. 查询:`has(perm)` / `assertNetworkAllowed(reason)`
 * 2. 主动守卫:`applyNetworkGuard()` 在 try/finally 中临时 monkey-patch
 *    fetch / XMLHttpRequest / WebSocket / EventSource,声明 network:none
 *    时这些 API 调用立即抛 NetworkGuardError,restore 函数恢复原实现
 *
 * 设计取舍:
 * - 真正的进程隔离(Realm / Worker / iframe sandbox)不在 W18.6 范围,
 *   这里做 install-time monkey-patch,覆盖 99% 的网络
 *   调用路径(原生 fetch / XHR / WebSocket / EventSource)
 * - 沙箱**仅在 installPlugin() 期间生效**(applyNetworkGuard 在
 *   installPlugin 的 try/finally 中应用)。capability execute()
 *   期间**不**应用 network guard —— execute 路径由 plugin 代码
 *   自行据 ctx.sandbox.assertNetworkAllowed() 主动自检
 * - 窗口外(如插件 setTimeout 异步调用)无法覆盖 —— 这是有意为之的
 *   "best-effort 守卫",plugin 作者应据 ctx.sandbox 自检再调用
 * - 文件系统权限(filesystem:opfs / filesystem:local)目前仅做断言,
 *   不 monkey-patch OPFS API(navigator.storage.getDirectory 等覆盖面
 *   有限,留待后续 W18.x 加 strict mode 时补)
 *
 * @see docs/PROJECT_PLAN.md W18.6
 */

import type { PluginPermission, PluginPermissionSandbox as IPluginPermissionSandbox } from '@lokvis/schema';

/** 权限断言失败时抛出(声明 X 但未声明 Y 又调用 Y 时) */
export class PluginPermissionError extends Error {
  readonly pluginName: string;
  readonly permission: PluginPermission;
  readonly reason: string;

  constructor(pluginName: string, permission: PluginPermission, reason: string) {
    super(
      `Plugin "${pluginName}" permission denied: requires "${permission}" but not declared. ` +
        `Reason: ${reason}`
    );
    this.name = 'PluginPermissionError';
    this.pluginName = pluginName;
    this.permission = permission;
    this.reason = reason;
  }
}

/** 网络守卫拦截时抛出(声明 network:none 又调网络 API 时) */
export class NetworkGuardError extends Error {
  readonly pluginName: string;
  readonly api: string;

  constructor(pluginName: string, api: string) {
    super(
      `Plugin "${pluginName}" declared "network:none" but called ${api}(). ` +
        'If network access is required, add "network:limited" or "network:full" to plugin.config.permissions.'
    );
    this.name = 'NetworkGuardError';
    this.pluginName = pluginName;
    this.api = api;
  }
}

/**
 * 文件系统守卫拦截时抛出(预留未启用)。
 *
 * W18.6 的 filesystem 权限目前仅做 `assertFilesystemAllowed()` 主动断言
 * (抛 `PluginPermissionError`),不 monkey-patch OPFS API。
 * 此类预留给后续 W18.x strict mode(覆盖 navigator.storage / showOpenFilePicker
 * 等 API)使用,当前为未启用的占位类,生产代码不会抛出此错误。
 */
export class FilesystemGuardError extends Error {
  readonly pluginName: string;
  readonly scope: 'opfs' | 'local';

  constructor(pluginName: string, scope: 'opfs' | 'local') {
    const perm = scope === 'opfs' ? 'filesystem:opfs' : 'filesystem:local';
    super(
      `Plugin "${pluginName}" called ${scope} filesystem API but did not declare "${perm}". ` +
        'Add it to plugin.config.permissions if filesystem access is intended.'
    );
    this.name = 'FilesystemGuardError';
    this.pluginName = pluginName;
    this.scope = scope;
  }
}

/**
 * Plugin 权限沙箱。
 *
 * 一个插件对应一个 sandbox 实例,生命周期与 installPlugin() 一致。
 * applyNetworkGuard() 在 installPlugin 的 try/finally 中应用;
 * capability execute() 路径不自动应用守卫(由 plugin 主动自检)。
 */
export class PluginPermissionSandbox implements IPluginPermissionSandbox {
  readonly pluginName: string;
  readonly declared: ReadonlySet<PluginPermission>;

  constructor(pluginName: string, permissions: PluginPermission[] | undefined) {
    this.pluginName = pluginName;
    this.declared = new Set(permissions ?? []);
  }

  /** 是否声明了指定权限 */
  has(perm: PluginPermission): boolean {
    return this.declared.has(perm);
  }

  /**
   * 断言网络调用允许(声明 network:none 时抛错)。
   *
   * Plugin 在调用 fetch / XHR 等前可主动调用:
   *   ctx.sandbox.assertNetworkAllowed('loading model manifest')
   * 若声明了 network:none,立即抛 PluginPermissionError;否则 no-op。
   */
  assertNetworkAllowed(reason: string): void {
    if (this.declared.has('network:none')) {
      throw new PluginPermissionError(this.pluginName, 'network:none', reason);
    }
  }

  /**
   * 断言文件系统访问允许(声明未含对应 filesystem:* 时抛错)。
   *
   * @param scope 'opfs'(OPFS 根目录访问)或 'local'(任意本地文件系统)
   */
  assertFilesystemAllowed(scope: 'opfs' | 'local', reason: string): void {
    const required: PluginPermission =
      scope === 'opfs' ? 'filesystem:opfs' : 'filesystem:local';
    if (!this.declared.has(required)) {
      throw new PluginPermissionError(this.pluginName, required, reason);
    }
  }

  /**
   * 应用网络守卫(network:none 声明时,monkey-patch fetch/XHR/WebSocket/
   * EventSource 使其调用即抛 NetworkGuardError)。
   *
   * 返回 restore 函数,必须在 try/finally 中调用以恢复全局 API。
   * 非限制插件(network:limited / network:full / 未声明)返回 no-op。
   *
   * @example
   * ```ts
   * const restore = sandbox.applyNetworkGuard();
   * try {
   *   await plugin.install(ctx);
   * } finally {
   *   restore();
   * }
   * ```
   */
  applyNetworkGuard(): () => void {
    if (!this.declared.has('network:none')) {
      return () => {
        /* no-op: plugin未声明 network:none */
      };
    }

    const pluginName = this.pluginName;
    const blocked = (api: string): never => {
      throw new NetworkGuardError(pluginName, api);
    };

    // 保存原实现(部分 API 在非浏览器环境可能不存在,条件守卫)
    // 注:TS DOM lib 将 fetch/XHR/WebSocket/EventSource 声明为总是定义,
    // 但 Node.js 等非浏览器环境实际为 undefined。用 `as ... | undefined`
    // 让 `if (x)` 守卫不被 TS 视为恒真(TS2774)。
    const origFetch = globalThis.fetch as typeof fetch | undefined;
    const OrigXHR = globalThis.XMLHttpRequest as typeof XMLHttpRequest | undefined;
    const origXHRopen = OrigXHR?.prototype.open;
    const origWebSocket = globalThis.WebSocket as typeof WebSocket | undefined;
    const origEventSource = globalThis.EventSource as typeof EventSource | undefined;

    // patch fetch(全局函数) — blocked 返回 never,故 () => blocked(...) 类型为
    // () => never,可赋值给任意函数类型(包括 typeof fetch 的重载签名)
    if (origFetch) {
      globalThis.fetch = (() => blocked('fetch')) as typeof fetch;
    }

    // patch XMLHttpRequest.open(原型方法,跨边界 monkey-patch)
    // 用 Object.defineProperty 替代直接赋值:PropertyDescriptor.value 为 any,
    // 无需为 `() => never` 与原生重载签名的不兼容做 `as unknown as` 双断言
    // (TD-4.5)。writable/configurable 显式为 true,与原生原型方法描述符一致。
    if (OrigXHR) {
      Object.defineProperty(OrigXHR.prototype, 'open', {
        value: function (this: XMLHttpRequest, ..._args: unknown[]): never {
          return blocked('XMLHttpRequest.open');
        },
        writable: true,
        configurable: true,
      });
    }

    // patch WebSocket(构造器,需支持 new;跨边界 monkey-patch)
    if (origWebSocket) {
      const BlockedWS = function (this: unknown, ..._args: unknown[]): never {
        return blocked('WebSocket');
      };
      // 保留原型链,instanceof 检查仍可通过(虽然实际不会构造成功)
      BlockedWS.prototype = origWebSocket.prototype;
      Object.defineProperty(globalThis, 'WebSocket', {
        value: BlockedWS,
        writable: true,
        configurable: true,
      });
    }

    // patch EventSource(构造器,跨边界 monkey-patch)
    if (origEventSource) {
      const BlockedES = function (this: unknown, ..._args: unknown[]): never {
        return blocked('EventSource');
      };
      BlockedES.prototype = origEventSource.prototype;
      Object.defineProperty(globalThis, 'EventSource', {
        value: BlockedES,
        writable: true,
        configurable: true,
      });
    }

    // restore 函数
    return () => {
      if (origFetch) globalThis.fetch = origFetch;
      if (OrigXHR && origXHRopen) OrigXHR.prototype.open = origXHRopen;
      if (origWebSocket) globalThis.WebSocket = origWebSocket;
      if (origEventSource) globalThis.EventSource = origEventSource;
    };
  }
}

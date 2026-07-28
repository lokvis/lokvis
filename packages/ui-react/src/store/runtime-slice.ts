/**
 * Runtime slice —— Runtime 初始化与状态消息
 *
 * 负责 runtime 实例注入、初始化、全局状态消息与错误、存储配额(W6.7)、
 * 历史栈事件桥接(W7.1)。
 */
import type { StateCreator } from 'zustand';
import type { LokvisEvent } from '@lokvis/schema';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';
import { reuseSubscription } from './subscribe-utils.js';

export interface RuntimeSlice
  extends Pick<
      WorkspaceState,
      | 'runtime'
      | 'initializing'
      | 'initError'
      | 'running'
      | 'statusMessage'
      | 'error'
      | 'errorSeq'
      | 'storageUsage'
    >,
    Pick<
      WorkspaceActions,
      'init' | 'setStatus' | 'setError' | 'refreshStorageUsage'
    > {}

/**
 * 历史事件订阅解除函数。
 *
 * 修复 review 报告:原为模块级 let,多个 store 实例(测试 / 多 Workspace)
 * 共用同一变量,后创建的 store 会覆盖前者,先前的订阅无法被正确清理 → 泄漏。
 * 现迁到 createRuntime slice 工厂闭包内,每个 store 实例持有独立 offFn。
 */
export const createRuntimeSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  RuntimeSlice
> = (set, get) => {
  /**
   * 当前 store 实例的历史订阅(TD-6.2 重入安全订阅)。
   * reuseSubscription 在 subscribe() 时自动清理上一个订阅,避免重复订阅泄漏。
   * 每个闭包持有独立实例,多个 store 实例(测试 / 多 Workspace)互不干扰。
   */
  const historySub = reuseSubscription(() => {
    const { runtime } = get();
    if (!runtime) return () => {};
    return runtime.eventBus.on('history:changed', (e: LokvisEvent) => {
      if (e.type !== 'history:changed') return;
      set({
        historyEntries: e.entries,
        historyCursor: e.currentIndex,
        historyWorkflowId: e.workflowId,
      });
    });
  });

  /**
   * Panel 注册事件订阅(UI 扩展点)。
   *
   * Plugin 通过 ctx.registerPanel() 注册 Panel 时 runtime 发射
   * panel:registered;本订阅把最新 Panel 列表同步到 store,
   * PluginPanels 组件无需各自订阅。与 historySub 同为闭包内实例,
   * 多 store 互不干扰(TD-6.2 模式)。
   */
  const panelSub = reuseSubscription(() => {
    const { runtime } = get();
    if (!runtime) return () => {};
    return runtime.eventBus.on('panel:registered', (e: LokvisEvent) => {
      if (e.type !== 'panel:registered') return;
      get().refreshPanels();
    });
  });

  /**
   * Plugin 加载事件订阅(capability 自动刷新)。
   *
   * 初始化完成后经 runtime.loadPlugin() 加载的插件,其 capability
   * 不会自动进入 store;本订阅监听 plugin:loaded 事件并刷新能力列表,
   * 使新插件的 capability 立即出现在 Inspector / CommandPalette /
   * WorkflowEditor,无需三方手动调用 refreshCapabilities()。
   * 与 historySub / panelSub 同为闭包内实例,多 store 互不干扰(TD-6.2 模式)。
   */
  const pluginSub = reuseSubscription(() => {
    const { runtime } = get();
    if (!runtime) return () => {};
    return runtime.eventBus.on('plugin:loaded', () => {
      get().refreshCapabilities().catch(() => {
        // 刷新失败不阻断插件加载事件本身;下次 init / 手动 refresh 可自愈
      });
    });
  });

  return {
    runtime: null,
    initializing: false,
    initError: null,
    running: false,
    statusMessage: { key: 'status.idle' },
    error: null,
    errorSeq: 0,
    storageUsage: null,

    async init(runtime) {
      set({ runtime, initializing: true, initError: null });
      try {
        // W7.1: 订阅 history:changed,把 runtime 历史事件桥接到 store,
        // 使 HistoryPanel 无需各自订阅,store 成为历史状态单一来源。
        // workspace 单工作流场景下直接采用事件携带的 workflowId/entries/cursor
        // 覆盖 store,无需额外过滤。
        // TD-6.2: reuseSubscription 在重入 init 时自动清理上一次订阅
        historySub.subscribe();
        // Panel 注册事件桥接:UI 扩展点,见 panelSub 注释
        panelSub.subscribe();
        // Plugin 加载事件桥接:自动刷新 capability,见 pluginSub 注释
        pluginSub.subscribe();
        await get().refreshAssets();
        await get().refreshCapabilities();
        get().refreshPanels();
        await get().refreshStorageUsage();
        set({ initializing: false, statusMessage: { key: 'status.ready' } });
      } catch (err) {
        set({
          initializing: false,
          initError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    setStatus(key, params) {
      set({ statusMessage: { key, params } });
    },

    setError(error) {
      // errorSeq 在设置非 null error 时递增,使 ErrorBanner 能感知新错误事件
      // 重新弹出(避免相同错误消息重复出现时 banner 因引用相等不触发 useEffect)
      set((state) => ({
        error,
        errorSeq: error !== null ? state.errorSeq + 1 : state.errorSeq,
      }));
    },

    async refreshStorageUsage() {
      const { runtime } = get();
      if (!runtime) return;
      try {
        const usage = await runtime.getStorageUsage();
        set({ storageUsage: usage });
      } catch {
        // 查询失败不阻断,保持上次值或 null
      }
    },
  };
};

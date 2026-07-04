/**
 * Runtime slice —— Runtime 初始化与状态消息
 *
 * 负责 runtime 实例注入、初始化、全局状态消息与错误、存储配额(W6.7)、
 * 历史栈事件桥接(W7.1)。
 */
import type { StateCreator } from 'zustand';
import type { LokvisEvent } from '@lokvis/schema';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

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
  /** 当前 store 实例的历史订阅解除函数(闭包私有,实例间隔离) */
  let offHistoryChanged: (() => void) | null = null;

  return {
    runtime: null,
    initializing: false,
    initError: null,
    running: false,
    statusMessage: 'Idle',
    error: null,
    errorSeq: 0,
    storageUsage: null,

    async init(runtime) {
      // 重入 init 时先清理上一次的历史订阅(避免重复订阅泄漏)
      if (offHistoryChanged) {
        offHistoryChanged();
        offHistoryChanged = null;
      }
      set({ runtime, initializing: true, initError: null });
      try {
        // W7.1: 订阅 history:changed,把 runtime 历史事件桥接到 store,
        // 使 HistoryPanel 无需各自订阅,store 成为历史状态单一来源。
        // workspace 单工作流场景下直接采用事件携带的 workflowId/entries/cursor
        // 覆盖 store,无需额外过滤。
        offHistoryChanged = runtime.eventBus.on('history:changed', (e: LokvisEvent) => {
          if (e.type !== 'history:changed') return;
          set({
            historyEntries: e.entries,
            historyCursor: e.currentIndex,
            historyWorkflowId: e.workflowId,
          });
        });
        await get().refreshAssets();
        await get().refreshCapabilities();
        await get().refreshStorageUsage();
        set({ initializing: false, statusMessage: 'Ready' });
      } catch (err) {
        set({
          initializing: false,
          initError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    setStatus(message) {
      set({ statusMessage: message });
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

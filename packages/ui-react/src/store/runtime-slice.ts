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
      | 'storageUsage'
    >,
    Pick<
      WorkspaceActions,
      'init' | 'setStatus' | 'setError' | 'refreshStorageUsage'
    > {}

/** 历史事件订阅解除函数,供 init 重入时清理 */
let offHistoryChanged: (() => void) | null = null;

export const createRuntimeSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  RuntimeSlice
> = (set, get) => ({
  runtime: null,
  initializing: false,
  initError: null,
  running: false,
  statusMessage: 'Idle',
  error: null,
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
    set({ error });
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
});

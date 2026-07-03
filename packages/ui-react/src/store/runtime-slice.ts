/**
 * Runtime slice —— Runtime 初始化与状态消息
 *
 * 负责 runtime 实例注入、初始化、全局状态消息与错误、存储配额(W6.7)。
 */
import type { StateCreator } from 'zustand';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

export interface RuntimeSlice
  extends Pick<
      WorkspaceState,
      'runtime' | 'initializing' | 'initError' | 'running' | 'statusMessage' | 'error' | 'storageUsage'
    >,
    Pick<
      WorkspaceActions,
      'init' | 'setStatus' | 'setError' | 'refreshStorageUsage'
    > {}

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
    set({ runtime, initializing: true, initError: null });
    try {
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

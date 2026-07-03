/**
 * History slice —— 历史栈状态与撤销/重做/跳转(W7.1)
 *
 * 负责:
 * - 跟踪当前活跃工作流的历史条目与游标(供 HistoryPanel 高亮当前步骤)
 * - undo / redo / jumpTo 委托给 runtime,history:changed 事件回流自动更新 state
 *
 * 事件桥接:runtime-slice.init 订阅 history:changed,回调里 set 本 slice 的
 * state,保证 store 是历史状态的单一来源,组件无需各自订阅。
 */
import type { StateCreator } from 'zustand';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

export interface HistorySlice
  extends Pick<
      WorkspaceState,
      'historyEntries' | 'historyCursor' | 'historyWorkflowId'
    >,
    Pick<WorkspaceActions, 'refreshHistory' | 'undo' | 'redo' | 'jumpToHistory'> {}

export const createHistorySlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  historyEntries: [],
  historyCursor: -1,
  historyWorkflowId: null,

  async refreshHistory(workflowId) {
    const { runtime } = get();
    if (!runtime) return;
    try {
      const { entries, cursor } = await runtime.getHistoryState(workflowId);
      set({
        historyEntries: entries,
        historyCursor: cursor,
        historyWorkflowId: workflowId,
      });
    } catch {
      // 查询失败保持上次值,不阻断
    }
  },

  async undo() {
    const { runtime, historyWorkflowId } = get();
    if (!runtime || !historyWorkflowId) return;
    await runtime.undo(historyWorkflowId);
    // history:changed 事件会触发 runtime-slice 的订阅回调更新 state,
    // 此处无需手动 refresh,避免双发
  },

  async redo() {
    const { runtime, historyWorkflowId } = get();
    if (!runtime || !historyWorkflowId) return;
    await runtime.redo(historyWorkflowId);
  },

  async jumpToHistory(index) {
    const { runtime, historyWorkflowId } = get();
    if (!runtime || !historyWorkflowId) return;
    await runtime.jumpTo(historyWorkflowId, index);
  },
});

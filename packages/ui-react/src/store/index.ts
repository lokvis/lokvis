/**
 * Workspace UI 状态管理(Zustand)
 *
 * 按域拆分为 6 个 slice:
 * - runtime-slice:      Runtime 初始化、全局状态消息、错误
 * - assets-slice:       资产导入 / 选择 / 删除 / 缩略图
 * - capabilities-slice: 能力列表与映射
 * - panels-slice:       插件 Panel 定义列表(UI 扩展点)
 * - workflow-slice:     工作流节点编排与执行
 * - history-slice:      历史栈(W7.1)
 *
 * 各 slice 独立演进,W6/W7/W9 扩展时按 slice 添加 action 即可。
 * Runtime 永远不知道 React,但 UI 层负责把 Runtime 事件桥接到 store。
 */
import { create } from 'zustand';
import type { WorkspaceStore } from './types.js';
import { createRuntimeSlice } from './runtime-slice.js';
import { createAssetsSlice } from './assets-slice.js';
import { createCapabilitiesSlice } from './capabilities-slice.js';
import { createPanelsSlice } from './panels-slice.js';
import { createWorkflowSlice } from './workflow-slice.js';
import { createHistorySlice } from './history-slice.js';

export const useWorkspaceStore = create<WorkspaceStore>()((...a) => ({
  ...createRuntimeSlice(...a),
  ...createAssetsSlice(...a),
  ...createCapabilitiesSlice(...a),
  ...createPanelsSlice(...a),
  ...createWorkflowSlice(...a),
  ...createHistorySlice(...a),
}));

export type { WorkspaceState, WorkspaceActions, WorkspaceStore } from './types.js';
export { MAX_WORKFLOW_STEPS } from '@lokvis/schema';

/**
 * Workspace UI 状态管理(Zustand)
 *
 * 按域拆分为 4 个 slice:
 * - runtime-slice:      Runtime 初始化、全局状态消息、错误
 * - assets-slice:       资产导入 / 选择 / 删除 / 缩略图
 * - capabilities-slice: 能力列表与映射
 * - workflow-slice:     工作流节点编排与执行
 *
 * 各 slice 独立演进,W6/W7/W9 扩展时按 slice 添加 action 即可。
 * Runtime 永远不知道 React,但 UI 层负责把 Runtime 事件桥接到 store。
 */
import { create } from 'zustand';
import type { WorkspaceStore } from './types.js';
import { createRuntimeSlice } from './runtime-slice.js';
import { createAssetsSlice } from './assets-slice.js';
import { createCapabilitiesSlice } from './capabilities-slice.js';
import { createWorkflowSlice } from './workflow-slice.js';
import { createHistorySlice } from './history-slice.js';

export const useWorkspaceStore = create<WorkspaceStore>()((...a) => ({
  ...createRuntimeSlice(...a),
  ...createAssetsSlice(...a),
  ...createCapabilitiesSlice(...a),
  ...createWorkflowSlice(...a),
  ...createHistorySlice(...a),
}));

export type { WorkspaceState, WorkspaceActions, WorkspaceStore } from './types.js';
export { MAX_WORKFLOW_STEPS } from './types.js';

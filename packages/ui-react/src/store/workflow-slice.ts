/**
 * Workflow slice —— 工作流节点编排与执行
 *
 * 负责:
 * - 节点 CRUD(add / remove / updateParams / select / setNodeStatus)
 * - 工作流执行(run):构建线性 Workflow → 调用 runtime.run → 更新节点状态
 * - 清空(clearWorkflow)
 *
 * run() 内部依赖 buildLinearWorkflow(本地工具)把节点序列构建为 Workflow 定义。
 */
import type { StateCreator } from 'zustand';
import type { Asset, Workflow, WorkflowEdge, WorkflowNode } from '@lokvis/schema';
import type { WorkspaceNode } from '../types.js';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';
import { genNodeId } from './types.js';

export interface WorkflowSlice
  extends Pick<WorkspaceState, 'nodes' | 'selectedNodeId' | 'lastOutputIds' | 'selectedOutputId'>,
    Pick<
      WorkspaceActions,
      | 'addNode'
      | 'updateNodeParams'
      | 'removeNode'
      | 'selectNode'
      | 'setNodeStatus'
      | 'run'
      | 'clearWorkflow'
      | 'selectOutput'
      | 'clearOutputs'
    > {}

export const createWorkflowSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  WorkflowSlice
> = (set, get) => ({
  nodes: [],
  selectedNodeId: null,
  lastOutputIds: [],
  selectedOutputId: null,

  addNode(capability) {
    const node: WorkspaceNode = {
      id: genNodeId(),
      capability,
      params: {},
      status: 'idle',
    };
    set((state) => ({
      nodes: [...state.nodes, node],
      selectedNodeId: node.id,
    }));
  },

  updateNodeParams(id, params) {
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, params } : n)),
    }));
  },

  removeNode(id) {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
  },

  selectNode(id) {
    set({ selectedNodeId: id });
  },

  setNodeStatus(id, status, error, duration) {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, status, error, duration } : n
      ),
    }));
  },

  async run() {
    const { runtime, nodes, selectedAssetId } = get();
    if (!runtime) throw new Error('Runtime not initialized');
    if (nodes.length === 0) throw new Error('Workflow is empty');
    if (!selectedAssetId) throw new Error('No asset selected');

    set({ running: true, error: null, statusMessage: 'Running...' });

    // 重置所有节点状态
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, status: 'pending', error: undefined, duration: undefined })),
    }));

    // 修复 review 报告：原实现节点状态粒度不足
    //   - completed: 全部节点设 success（OK，但无耗时）
    //   - failed: 仅把仍为 pending 的节点设 failed，但 executor 在抛错前已 emit
    //     node:finished 给前面成功的节点（这些 status 仍是 pending）→ 这些节点
    //     也被标 failed，UI 误显示前面成功的步骤都失败了
    //   - cancelled: 完全未处理
    //
    // 修复：订阅 node:started / node:finished / node:failed 事件实时更新节点状态，
    //       这样 completed/failed/cancelled 三种情况下节点状态都精确
    const offStarted = runtime.eventBus.on('node:started', (e) => {
      get().setNodeStatus(e.nodeId, 'running');
    });
    const offFinished = runtime.eventBus.on('node:finished', (e) => {
      get().setNodeStatus(e.nodeId, 'success', undefined, e.duration);
    });
    const offNodeFailed = runtime.eventBus.on('node:failed', (e) => {
      const errMsg = e.error instanceof Error ? e.error.message : String(e.error);
      get().setNodeStatus(e.nodeId, 'failed', errMsg);
    });

    try {
      // 构建 Workflow
      const workflow = buildLinearWorkflow(nodes);
      const input = await runtime.getAsset(selectedAssetId);

      set({ statusMessage: 'Running workflow...' });
      const result = await runtime.run(workflow, [input]);

      // 兜底：取消订阅后，根据 result.status 把剩余 pending 节点归位
      //   - completed: finishedNodeIds 已涵盖所有节点（无需额外处理）
      //   - failed: 失败节点之后未执行的节点标 cancelled
      //   - cancelled: 失败节点之外所有 running/pending 节点标 cancelled
      if (result.status !== 'completed') {
        for (const node of get().nodes) {
          if (node.status === 'pending' || node.status === 'running') {
            get().setNodeStatus(node.id, 'cancelled');
          }
        }
      }

      // 加载输出资产
      const outputs: Asset[] = [];
      for (const id of result.outputs) {
        try {
          outputs.push(await runtime.getAsset(id));
        } catch {
          // skip
        }
      }

      // W9.4/W9.5: 记录输出 Asset ID,供 before/after 对比与下载管理使用。
      // 仅在 status === 'completed' 时记录,失败/取消的输出无意义。
      if (result.status === 'completed' && outputs.length > 0) {
        const firstOutput = outputs[0];
        set({
          lastOutputIds: outputs.map((o) => o.id),
          selectedOutputId: firstOutput ? firstOutput.id : null,
        });
      }

      set({
        running: false,
        statusMessage: `Workflow ${result.status} in ${result.duration}ms`,
      });

      if (result.status === 'failed') {
        set({ error: result.error ?? 'Workflow failed' });
      }

      await get().refreshAssets();
      await get().refreshStorageUsage();
      return outputs;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        running: false,
        error: message,
        statusMessage: 'Failed',
      });
      // 异常退出时把仍在 pending/running 的节点标 failed
      for (const node of get().nodes) {
        if (node.status === 'pending' || node.status === 'running') {
          get().setNodeStatus(node.id, 'failed', message);
        }
      }
      throw err;
    } finally {
      offStarted();
      offFinished();
      offNodeFailed();
    }
  },

  clearWorkflow() {
    set({ nodes: [], selectedNodeId: null });
  },

  selectOutput(id) {
    set({ selectedOutputId: id });
  },

  clearOutputs() {
    set({ lastOutputIds: [], selectedOutputId: null });
  },
});

/** 把工作台节点序列构建为线性 Workflow */
function buildLinearWorkflow(nodes: WorkspaceNode[]): Workflow {
  if (nodes.length === 0) {
    throw new Error('Workflow is empty');
  }
  const workflowNodes: WorkflowNode[] = nodes.map((n) => ({
    id: n.id,
    type: 'transform' as const,
    capability: n.capability,
    params: n.params,
  }));
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < workflowNodes.length - 1; i++) {
    edges.push({ from: workflowNodes[i]!.id, to: workflowNodes[i + 1]!.id });
  }
  return {
    id: `wf_${Date.now().toString(36)}`,
    name: 'Workspace Workflow',
    version: '1',
    description: 'Workspace linear workflow',
    author: { id: 'local', name: 'Local User' },
    category: 'image',
    tags: [],
    nodes: workflowNodes,
    edges,
    inputs: { type: 'image', multiple: true },
    outputs: { type: 'image' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

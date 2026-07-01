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
  extends Pick<WorkspaceState, 'nodes' | 'selectedNodeId'>,
    Pick<
      WorkspaceActions,
      | 'addNode'
      | 'updateNodeParams'
      | 'removeNode'
      | 'selectNode'
      | 'setNodeStatus'
      | 'run'
      | 'clearWorkflow'
    > {}

export const createWorkflowSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  WorkflowSlice
> = (set, get) => ({
  nodes: [],
  selectedNodeId: null,

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
      nodes: state.nodes.map((n) => ({ ...n, status: 'pending', error: undefined })),
    }));

    try {
      // 构建 Workflow
      const workflow = buildLinearWorkflow(nodes);
      const input = await runtime.getAsset(selectedAssetId);

      set({ statusMessage: 'Running workflow...' });
      const result = await runtime.run(workflow, [input]);

      // 更新节点状态
      if (result.status === 'completed') {
        for (const node of nodes) {
          get().setNodeStatus(node.id, 'success', undefined, undefined);
        }
      } else if (result.status === 'failed') {
        for (const node of nodes) {
          if (get().nodes.find((n) => n.id === node.id)?.status === 'pending') {
            get().setNodeStatus(node.id, 'failed', result.error);
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

      set({
        running: false,
        statusMessage: `Workflow ${result.status} in ${result.duration}ms`,
      });

      if (result.status === 'failed') {
        set({ error: result.error ?? 'Workflow failed' });
      }

      await get().refreshAssets();
      return outputs;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        running: false,
        error: message,
        statusMessage: 'Failed',
      });
      throw err;
    }
  },

  clearWorkflow() {
    set({ nodes: [], selectedNodeId: null });
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

/**
 * Workspace UI 状态管理
 *
 * 使用 Zustand 管理工作台状态。Runtime 永远不知道 React，
 * 但 UI 层负责把 Runtime 事件桥接到 store。
 */

import { create } from 'zustand';
import type { Asset, Capability } from '@lokvis/schema';
import type { LokvisRuntime } from '@lokvis/runtime';
import type {
  CapabilityMap,
  NodeStatus,
  WorkspaceNode,
} from './types.js';

/** 工作台完整状态 */
export interface WorkspaceState {
  /** Runtime 实例 */
  runtime: LokvisRuntime | null;
  /** 是否正在初始化 Runtime */
  initializing: boolean;
  /** 初始化错误 */
  initError: string | null;

  /** 所有已导入资产 */
  assets: Asset[];
  /** 当前选中的资产 ID */
  selectedAssetId: string | null;
  /** 资产缩略图（AssetId → ObjectURL） */
  thumbnails: Record<string, string>;

  /** 所有已注册能力 */
  capabilities: Capability[];
  /** 能力映射表（name → Capability） */
  capabilityMap: CapabilityMap;

  /** 工作流节点序列（线性链） */
  nodes: WorkspaceNode[];
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;

  /** 是否正在执行工作流 */
  running: boolean;
  /** 全局状态消息 */
  statusMessage: string;
  /** 错误信息 */
  error: string | null;
}

/** 工作台操作 */
export interface WorkspaceActions {
  /** 初始化 Runtime */
  init(runtime: LokvisRuntime): Promise<void>;
  /** 刷新资产列表 */
  refreshAssets(): Promise<void>;
  /** 刷新能力列表 */
  refreshCapabilities(): Promise<void>;
  /** 导入文件 */
  importFiles(files: File[]): Promise<void>;
  /** 选择资产 */
  selectAsset(id: string | null): void;
  /** 设置缩略图 */
  setThumbnail(id: string, url: string): void;
  /** 删除资产 */
  removeAsset(id: string): Promise<void>;

  /** 添加工作流节点 */
  addNode(capability: string): void;
  /** 更新节点参数 */
  updateNodeParams(id: string, params: Record<string, unknown>): void;
  /** 删除节点 */
  removeNode(id: string): void;
  /** 选择节点 */
  selectNode(id: string | null): void;
  /** 设置节点状态 */
  setNodeStatus(id: string, status: NodeStatus, error?: string, duration?: number): void;

  /** 执行工作流 */
  run(): Promise<Asset[]>;
  /** 设置状态消息 */
  setStatus(message: string): void;
  /** 设置错误 */
  setError(error: string | null): void;
  /** 清空工作流 */
  clearWorkflow(): void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

/** 生成节点 ID */
function genNodeId(): string {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  runtime: null,
  initializing: false,
  initError: null,

  assets: [],
  selectedAssetId: null,
  thumbnails: {},

  capabilities: [],
  capabilityMap: {},

  nodes: [],
  selectedNodeId: null,

  running: false,
  statusMessage: 'Idle',
  error: null,

  async init(runtime) {
    set({ runtime, initializing: true, initError: null });
    try {
      await get().refreshAssets();
      await get().refreshCapabilities();
      set({ initializing: false, statusMessage: 'Ready' });
    } catch (err) {
      set({
        initializing: false,
        initError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async refreshAssets() {
    const { runtime } = get();
    if (!runtime) return;
    const assets = await runtime.listAssets();
    set({ assets });
  },

  async refreshCapabilities() {
    const { runtime } = get();
    if (!runtime) return;
    const capabilities = await runtime.capabilities();
    const capabilityMap: CapabilityMap = {};
    for (const cap of capabilities) capabilityMap[cap.name] = cap;
    set({ capabilities, capabilityMap });
  },

  async importFiles(files) {
    const { runtime } = get();
    if (!runtime) return;
    set({ statusMessage: `Importing ${files.length} file(s)...` });
    for (const file of files) {
      await runtime.importAsset({ kind: 'file', file });
    }
    await get().refreshAssets();
    set({ statusMessage: `Imported ${files.length} file(s)` });
  },

  selectAsset(id) {
    set({ selectedAssetId: id });
  },

  setThumbnail(id, url) {
    set((state) => ({ thumbnails: { ...state.thumbnails, [id]: url } }));
  },

  async removeAsset(id) {
    const { runtime } = get();
    if (!runtime) return;
    await runtime.removeAsset(id);
    await get().refreshAssets();
    if (get().selectedAssetId === id) set({ selectedAssetId: null });
  },

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

  setStatus(message) {
    set({ statusMessage: message });
  },

  setError(error) {
    set({ error });
  },

  clearWorkflow() {
    set({ nodes: [], selectedNodeId: null });
  },
}));

/** 把工作台节点序列构建为线性 Workflow */
function buildLinearWorkflow(nodes: WorkspaceNode[]): import('@lokvis/schema').Workflow {
  if (nodes.length === 0) {
    throw new Error('Workflow is empty');
  }
  const workflowNodes: import('@lokvis/schema').WorkflowNode[] = nodes.map((n) => ({
    id: n.id,
    type: 'transform' as const,
    capability: n.capability,
    params: n.params,
  }));
  const edges: import('@lokvis/schema').WorkflowEdge[] = [];
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

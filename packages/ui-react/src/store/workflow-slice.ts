/**
 * Workflow slice —— 工作流节点编排与执行
 *
 * 负责:
 * - 节点 CRUD(add / remove / updateParams / select / setNodeStatus)
 * - 工作流执行(run):构建线性 Workflow → 调用 runtime.run → 更新节点状态
 * - 清空(clearWorkflow)
 *
 * run() 内部依赖 buildLinearWorkflow(@lokvis/workflow)把节点序列构建为 Workflow 定义。
 */
import type { StateCreator } from 'zustand';
import { MAX_WORKFLOW_STEPS, type Asset } from '@lokvis/schema';
import { buildLinearWorkflow } from '@lokvis/workflow';
import type { WorkspaceNode } from '../types.js';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';
import { subscribeAll } from './subscribe-utils.js';
import { genNodeId } from './types.js';

export interface WorkflowSlice
  extends Pick<WorkspaceState, 'nodes' | 'selectedNodeId' | 'lastOutputIds' | 'selectedOutputId' | 'currentRunId'>,
    Pick<
      WorkspaceActions,
      | 'addNode'
      | 'updateNodeParams'
      | 'removeNode'
      | 'selectNode'
      | 'setNodeStatus'
      | 'moveNode'
      | 'insertNodeAt'
      | 'run'
      | 'cancelRun'
      | 'loadWorkflowTemplate'
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
  currentRunId: null,

  addNode(capability) {
    // W10.1/W10.3: 节点数上限(MAX_WORKFLOW_STEPS,单一源 @lokvis/schema)
    if (get().nodes.length >= MAX_WORKFLOW_STEPS) {
      get().setError({ key: 'error.maxSteps', params: { max: MAX_WORKFLOW_STEPS } });
      return;
    }
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

  moveNode(from, to) {
    set((state) => {
      if (
        from < 0 || from >= state.nodes.length ||
        to < 0 || to >= state.nodes.length ||
        from === to
      ) {
        return {};
      }
      const next = [...state.nodes];
      const [moved] = next.splice(from, 1);
      if (!moved) return {};
      next.splice(to, 0, moved);
      return { nodes: next };
    });
  },

  insertNodeAt(index, capability) {
    // W11.1: 在指定位置插入节点(与节点数上限对齐)
    if (get().nodes.length >= MAX_WORKFLOW_STEPS) {
      get().setError({ key: 'error.maxSteps', params: { max: MAX_WORKFLOW_STEPS } });
      return;
    }
    if (!capability) return;
    const node: WorkspaceNode = {
      id: genNodeId(),
      capability,
      params: {},
      status: 'idle',
    };
    set((state) => {
      const next = [...state.nodes];
      const at = Math.max(0, Math.min(index, next.length));
      next.splice(at, 0, node);
      return { nodes: next, selectedNodeId: node.id };
    });
  },

  loadWorkflowTemplate(templateNodes) {
    // W11.4: 用模板节点序列替换当前工作流,清空上次输出
    const nodes: WorkspaceNode[] = templateNodes.map(({ capability, params }) => ({
      id: genNodeId(),
      capability,
      params,
      status: 'idle' as const,
    }));
    set({
      nodes,
      selectedNodeId: nodes[0]?.id ?? null,
      lastOutputIds: [],
      selectedOutputId: null,
      error: null,
    });
  },

  async cancelRun() {
    // W11.6: 取消当前运行。本函数仅负责向 runtime 发起 cancel 信号;
    // running / currentRunId / 节点状态的归位由 run() 的 finally 统一处理,
    // 避免 cancel 与 run() 的 finally 同时写状态造成竞态
    // (review 反馈:若 cancel() 抛错,旧实现仍会 set running: false 伪造
    //  "已停止",但底层工作流仍在运行,UI 状态与实际不符)。
    //
    // 时序:cancel() 成功 → runtime.run() 返回 status='cancelled'
    //       → run() 兜底把 pending/running 节点标 cancelled + finally 归位。
    // cancel() 抛错:不伪造停止状态,仅记录错误让用户感知"取消失败,仍在运行"。
    const { runtime, currentRunId } = get();
    if (!runtime || !currentRunId) return;
    set({ statusMessage: { key: 'status.cancelling' } });
    try {
      await runtime.cancel(currentRunId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[lokvis] cancelRun failed:', message);
      get().setError({ key: 'error.cancelFailed', params: { message } });
    }
    // 不在此设置 running / currentRunId / 节点状态;
    // 等 run() 的 await runtime.run() 返回后,由 run() 统一归位。
  },

  async run() {
    const { runtime, nodes, selectedAssetId, running, assets } = get();
    if (!runtime) throw new Error('Runtime not initialized');
    if (nodes.length === 0) throw new Error('Workflow is empty');
    if (!selectedAssetId) throw new Error('No asset selected');
    // 并发保护:正在运行时再次调用直接拒绝(避免事件订阅泄漏 + currentRunId 覆盖)
    if (running) {
      throw new Error('Workflow is already running');
    }

    set({ running: true, error: null, statusMessage: { key: 'status.running' }, currentRunId: null });

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
    const offAll = subscribeAll(runtime.eventBus, {
      'node:started': (e) => get().setNodeStatus(e.nodeId, 'running'),
      'node:finished': (e) => get().setNodeStatus(e.nodeId, 'success', undefined, e.duration),
      'node:failed': (e) => {
        const errMsg = e.error instanceof Error ? e.error.message : String(e.error);
        get().setNodeStatus(e.nodeId, 'failed', errMsg);
      },
    });

    try {
      // 从选中资产推导输入类型(去硬编码 'image')
      const selectedAsset = assets.find((a) => a.id === selectedAssetId);
      if (!selectedAsset) throw new Error('Selected asset not found');
      // 构建 Workflow
      const workflow = buildLinearWorkflow(nodes, selectedAsset.type);
      // W11.6: 记录当前 workflowId 供 cancelRun() 使用
      set({ currentRunId: workflow.id });
      const input = await runtime.getAsset(selectedAssetId);

      set({ statusMessage: { key: 'status.runningWorkflow' } });
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

      // 加载输出资产。失败时收集失败 id 并设置 error 让用户感知(不静默丢弃)
      const outputs: Asset[] = [];
      const failedOutputIds: string[] = [];
      for (const id of result.outputs) {
        try {
          outputs.push(await runtime.getAsset(id));
        } catch (err) {
          console.warn(`[lokvis] getAsset(${id}) failed:`, err);
          failedOutputIds.push(id);
        }
      }
      if (failedOutputIds.length > 0) {
        get().setError({
          key: 'error.outputsLoadFailed',
          params: { count: failedOutputIds.length },
        });
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

      // result.status: 'completed' | 'failed' | 'cancelled' → 对应 status.workflow* key
      const statusKey =
        result.status === 'completed'
          ? 'status.workflowCompleted'
          : result.status === 'failed'
            ? 'status.workflowFailed'
            : 'status.workflowCancelled';
      set({
        running: false,
        statusMessage: { key: statusKey, params: { duration: result.duration } },
      });

      if (result.status === 'failed') {
        get().setError(result.error ?? { key: 'error.workflowFailed' });
      }

      await get().refreshAssets();
      await get().refreshStorageUsage();
      return outputs;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        running: false,
        currentRunId: null,
        statusMessage: { key: 'status.failed' },
      });
      get().setError(message);
      // 异常退出时把仍在 pending/running 的节点标 failed
      for (const node of get().nodes) {
        if (node.status === 'pending' || node.status === 'running') {
          get().setNodeStatus(node.id, 'failed', message);
        }
      }
      throw err;
    } finally {
      // W11.6: 清除 currentRunId(成功/失败/取消都应清除)
      set({ currentRunId: null });
      offAll();
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

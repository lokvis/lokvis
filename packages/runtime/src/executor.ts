/**
 * Lokvis Workflow Executor
 *
 * 第一年只支持 Linear Workflow（线性链）。
 * 不支持：Branch / Loop / Condition / Parallel。
 */

import type {
  Asset,
  AssetId,
  ExecutionContext,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowResult,
} from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type { AssetStore } from './asset-store.js';
import type { CapabilityRegistry } from './capability-registry.js';

/** 执行中的工作流状态 */
interface RunningWorkflow {
  id: string;
  workflow: Workflow;
  status: 'running' | 'paused' | 'cancelled';
  abortController: AbortController;
  currentNodeId?: string;
}

/** Workflow 执行器配置 */
export interface ExecutorConfig {
  assetStore: AssetStore;
  capabilityRegistry: CapabilityRegistry;
  eventBus: EventBus;
  enableLog: boolean;
}

/** 创建执行上下文 */
function createExecutionContext(
  workflowId: string,
  nodeId: string,
  signal: AbortSignal,
  onProgress?: (progress: number, message?: string) => void
): ExecutionContext {
  return {
    workflowId,
    nodeId,
    signal,
    onProgress,
    log: (level, message) => {
      // 日志输出，可被 Analytics 监听
      if (level === 'error') {
        console.error(`[lokvis:${workflowId}:${nodeId}] ${message}`);
      } else if (level === 'warn') {
        console.warn(`[lokvis:${workflowId}:${nodeId}] ${message}`);
      }
    },
  };
}

/** 拓扑排序：将 edges 转换为线性节点序列 */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    adjacency.get(edge.from)?.push(edge.to);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    for (const next of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Workflow contains a cycle, cannot execute');
  }

  return sorted;
}

/** Workflow 执行器 */
export class WorkflowExecutor {
  private config: ExecutorConfig;
  private running = new Map<string, RunningWorkflow>();
  /** 暂停时挂起的 resolve:resume/cancel 唤醒之,避免轮询 */
  private resumeResolvers = new Map<string, () => void>();

  constructor(config: ExecutorConfig) {
    this.config = config;
  }

  /** 执行工作流 */
  async execute(
    workflow: Workflow,
    inputs: AssetId[] | Asset[]
  ): Promise<WorkflowResult> {
    const workflowId = workflow.id;
    const abortController = new AbortController();
    const startTime = Date.now();

    // 解析输入 Asset
    let currentAssets: Asset[];
    if (inputs.length === 0 || typeof inputs[0] === 'string') {
      // AssetId[] - 从 store 加载
      const ids = inputs as AssetId[];
      currentAssets = await Promise.all(
        ids.map(async (id) => {
          const asset = await this.config.assetStore.get(id);
          if (!asset) throw new Error(`Asset not found: ${id}`);
          return asset;
        })
      );
    } else {
      // Asset[]
      currentAssets = inputs as Asset[];
    }

    // 注册运行状态
    const state: RunningWorkflow = {
      id: workflowId,
      workflow,
      status: 'running',
      abortController,
    };
    this.running.set(workflowId, state);

    this.config.eventBus.emit({
      type: 'workflow:started',
      workflowId,
      workflow,
    });

    try {
      // 拓扑排序节点
      const sortedNodes = topologicalSort(workflow.nodes, workflow.edges);

      // 过滤掉 load 和 export 节点（load 由输入处理，export 由结果处理）
      const transformNodes = sortedNodes.filter((n) => n.type === 'transform');

      // 依次执行每个 transform 节点
      for (const node of transformNodes) {
        // 暂停则挂起,等待 resume/cancel 唤醒(Promise resolver,无轮询)
        if (state.status === 'paused') {
          await this.waitForResume(workflowId);
        }
        // 唤醒后或每轮起始,若已被取消立即跳出(避免执行多余节点)
        if (state.status === 'cancelled') {
          break;
        }

        state.currentNodeId = node.id;
        const nodeStart = Date.now();

        this.config.eventBus.emit({
          type: 'node:started',
          workflowId,
          nodeId: node.id,
          inputs: currentAssets,
        });

        // 解析能力实现(transform 节点必须有 capability)
        const capability = node.capability;
        if (!capability) {
          throw new Error(`Transform node "${node.id}" has no capability`);
        }
        const impl = this.config.capabilityRegistry.resolve(capability);
        if (!impl) {
          throw new Error(`No implementation registered for capability "${capability}"`);
        }

        // 执行能力
        const ctx = createExecutionContext(
          workflowId,
          node.id,
          abortController.signal
        );
        const outputs = await impl.execute(currentAssets, node.params ?? {}, ctx);
        currentAssets = outputs;

        this.config.eventBus.emit({
          type: 'node:finished',
          workflowId,
          nodeId: node.id,
          capability,
          params: node.params ?? {},
          outputs: currentAssets,
          duration: Date.now() - nodeStart,
        });
      }

      const result: WorkflowResult = {
        workflowId,
        outputs: currentAssets.map((a) => a.id),
        duration: Date.now() - startTime,
        status: state.status === 'cancelled' ? 'cancelled' : 'completed',
      };

      this.config.eventBus.emit({
        type: 'workflow:completed',
        workflowId,
        result,
      });

      return result;
    } catch (error) {
      const result: WorkflowResult = {
        workflowId,
        outputs: [],
        duration: Date.now() - startTime,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };

      this.config.eventBus.emit({
        type: 'node:failed',
        workflowId,
        nodeId: state.currentNodeId ?? 'unknown',
        error: error instanceof Error ? error : new Error(String(error)),
      });

      this.config.eventBus.emit({
        type: 'workflow:completed',
        workflowId,
        result,
      });

      return result;
    } finally {
      this.running.delete(workflowId);
      this.resumeResolvers.delete(workflowId);
    }
  }

  /** 取消执行 */
  async cancel(workflowId: string): Promise<void> {
    const state = this.running.get(workflowId);
    if (!state) return;
    state.status = 'cancelled';
    state.abortController.abort();
    // 唤醒可能暂停中的执行循环,使其跳出
    this.resolveResume(workflowId);
    this.config.eventBus.emit({ type: 'workflow:cancelled', workflowId });
  }

  /** 暂停执行 */
  async pause(workflowId: string): Promise<void> {
    const state = this.running.get(workflowId);
    if (!state || state.status !== 'running') return;
    state.status = 'paused';
    this.config.eventBus.emit({ type: 'workflow:paused', workflowId });
  }

  /** 恢复执行 */
  async resume(workflowId: string): Promise<void> {
    const state = this.running.get(workflowId);
    if (!state || state.status !== 'paused') return;
    state.status = 'running';
    // 唤醒挂起的 waitForResume,无需轮询
    this.resolveResume(workflowId);
    this.config.eventBus.emit({ type: 'workflow:resumed', workflowId });
  }

  /**
   * 挂起当前执行直到 resume/cancel 唤醒(Promise resolver 模式)。
   * 相比轮询(setTimeout)无延迟、无 CPU 占用;resume/cancel 通过
   * resolveResume 触发 resolver。
   */
  private waitForResume(workflowId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resumeResolvers.set(workflowId, resolve);
    });
  }

  /** 唤醒挂起的 waitForResume(若存在) */
  private resolveResume(workflowId: string): void {
    const resolve = this.resumeResolvers.get(workflowId);
    if (resolve) {
      this.resumeResolvers.delete(workflowId);
      resolve();
    }
  }
}

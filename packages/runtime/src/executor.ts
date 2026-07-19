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
import {
  AssetNotFoundError,
  WorkflowInvalidError,
  WorkflowCycleError,
  WorkflowNodeError,
  CapabilityNotRegisteredError,
  CapabilityStubOnlyError,
} from './errors.js';

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

/** 拓扑排序：将 edges 转换为线性节点序列。
 *
 * 修复 review 报告：原实现 edge.from 不在 nodeMap 时静默丢弃，
 * 但 edge.to 的入度仍被 +1，导致目标节点入度永远无法归零，
 * 被误判为「环」（demo 用 `__input__` 哨兵边触发此 bug）。
 * 现在显式校验所有 edge 引用必须对应真实节点，否则快速失败。
 */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // 校验节点 ID 唯一性
  if (nodeMap.size !== nodes.length) {
    const seen = new Set<string>();
    for (const n of nodes) {
      if (seen.has(n.id)) {
        throw new WorkflowInvalidError(`Workflow contains duplicate node id: ${n.id}`);
      }
      seen.add(n.id);
    }
  }

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // 校验 edge 引用必须存在于 nodes 中（防止 `__input__` 等哨兵节点
  // 被静默吞掉，进而导致下游节点入度无法归零 → 误判为环）
  for (const edge of edges) {
    if (!nodeMap.has(edge.from)) {
      throw new WorkflowInvalidError(
        `Workflow edge references unknown source node: "${edge.from}". ` +
          `Edge endpoints must reference existing nodes; ` +
          `reserved sentinel nodes (e.g. "__input__") are not supported ` +
          `by the executor — input assets are injected into the first node ` +
          `with in-degree 0.`
      );
    }
    if (!nodeMap.has(edge.to)) {
      throw new WorkflowInvalidError(
        `Workflow edge references unknown target node: "${edge.to}". ` +
          `Edge endpoints must reference existing nodes.`
      );
    }
    if (edge.from === edge.to) {
      throw new WorkflowInvalidError(
        `Workflow contains self-loop on node: "${edge.from}". ` +
          `Self-loops create cycles and are not allowed.`
      );
    }
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
    throw new WorkflowCycleError('Workflow contains a cycle, cannot execute');
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
          if (!asset) throw new AssetNotFoundError(id);
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

      // E1: 多 target 机制
      // targets 存在且非空时,为每个 target 独立执行一次 transform 链,
      // target.params 浅合并到每个节点的 params（target 优先）。
      // 无 targets 时等价于单次执行（targetParams = undefined）。
      const targets = workflow.outputs.targets;
      const targetParamSets: (Record<string, unknown> | undefined)[] =
        targets && targets.length > 0
          ? targets.map((t) => t.params)
          : [undefined];

      // 保存原始输入资产,每个 target 执行前重置
      const inputAssets = [...currentAssets];
      const allOutputs: Asset[] = [];
      /**
       * 各 transform 节点的输出 AssetId(按 node.id 索引)。
       * 仅单 target 场景填充(多 target 同一节点会有多份输出,
       * 索引歧义,留空让调用方走事件总线监听 node:finished)。
       */
      const stepOutputs: Record<string, AssetId[]> = {};
      const isSingleTarget = targetParamSets.length === 1;

      for (const targetParams of targetParamSets) {
        // 每个 target 开始前重置为原始输入
        currentAssets = [...inputAssets];

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
            throw new WorkflowNodeError(node.id, `Transform node "${node.id}" has no capability`);
          }
          const impl = this.config.capabilityRegistry.resolve(capability);
          if (!impl) {
            if (this.config.capabilityRegistry.isStubOnly(capability)) {
              throw new CapabilityStubOnlyError(capability);
            }
            throw new CapabilityNotRegisteredError(capability);
          }

          // E1: target params 覆盖 node params（浅合并,target 优先）
          // 注：展开 undefined 是 no-op,无需 ?? {} fallback（oxlint no-empty-fallback-in-spread）
          const mergedParams = targetParams
            ? { ...node.params, ...targetParams }
            : (node.params ?? {});

          // 执行能力
          const ctx = createExecutionContext(
            workflowId,
            node.id,
            abortController.signal
          );
          const outputs = await impl.execute(currentAssets, mergedParams, ctx);
          currentAssets = outputs;

          // 单 target 时记录该节点输出,供调用方读取中间结果
          // (多 target 场景跳过,避免 last-write-wins 语义歧义)
          if (isSingleTarget) {
            stepOutputs[node.id] = currentAssets.map((a) => a.id);
          }

          this.config.eventBus.emit({
            type: 'node:finished',
            workflowId,
            nodeId: node.id,
            capability,
            params: mergedParams,
            outputs: currentAssets,
            duration: Date.now() - nodeStart,
          });
        }

        // 收集当前 target 的输出（cancelled 时也保留已完成的节点输出）
        allOutputs.push(...currentAssets);

        if (state.status === 'cancelled') break;
      }

      const result: WorkflowResult = {
        workflowId,
        outputs: allOutputs.map((a) => a.id),
        // 单 target 且非取消时暴露中间步骤输出;其他场景保持 undefined,
        // 调用方需要中间结果时应改用 eventBus 监听 node:finished 事件
        stepOutputs: isSingleTarget && state.status !== 'cancelled' ? stepOutputs : undefined,
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

  /**
   * 取消所有运行中的工作流(W21.6 runtime.dispose 用)。
   *
   * 遍历 running Map,对每个 state 执行 cancel 的同步部分
   * (status = cancelled + abort + 唤醒 resume resolver + emit event)。
   * 不等待 executor.execute 内部循环跳出 —— abort 后循环在下个 await
   * 点自然抛 AbortError,资源随 Promise reject 释放。
   */
  cancelAll(): void {
    // 复制一份避免 cancel 内 emit 触发的 listener 回调 mutate 原集合
    for (const workflowId of [...this.running.keys()]) {
      void this.cancel(workflowId);
    }
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

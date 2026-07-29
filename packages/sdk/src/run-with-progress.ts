/**
 * runWithProgress —— 工作流执行编排(引擎中性)
 *
 * 把此前散落在 UI store(ui-react workflow-slice.run)中的「引擎中性」执行编排
 * 下沉到 SDK:订阅节点事件 → 调 runtime.run → 加载输出资产 → 卸载订阅。
 *
 * 本模块**不感知** UI 状态(zustand)/ i18n / 缩略图刷新等 UI 关切,
 * 只经 `onNodeStatus` 回调把中性的节点状态变化上抛给调用方,由调用方
 * 映射到各自的 UI(store 状态 / i18n 文案 / 进度条)。
 *
 * 取消仍走 `runtime.cancel(workflow.id)`(按 workflowId,非 AbortSignal),
 * 与 executor 的取消模型一致;本 helper 只负责订阅/执行/加载/卸载。
 */
import type { LokvisRuntime } from '@lokvis/runtime';
import type { Asset, AssetId, Workflow, WorkflowResult } from '@lokvis/schema';

/** 节点运行态(node 事件映射后的中性状态,不含 UI 的 idle/pending) */
export type NodeRunStatus = 'running' | 'success' | 'failed';

/** 单个节点的状态变化(由 node:started / node:finished / node:failed 派生) */
export interface NodeStatusUpdate {
  /** 节点 ID */
  nodeId: string;
  /** 运行态 */
  status: NodeRunStatus;
  /** 失败原因(status === 'failed' 时给出) */
  error?: string;
  /** 执行耗时(ms,status === 'success' 时给出) */
  duration?: number;
}

/** runWithProgress 选项 */
export interface RunWithProgressOptions {
  /**
   * 节点状态变化回调。runWithProgress 订阅 node:started/finished/failed,
   * 归一为 NodeStatusUpdate 后调用本回调。未传则不订阅节点事件。
   */
  onNodeStatus?: (update: NodeStatusUpdate) => void;
}

/** runWithProgress 结果 */
export interface RunWithProgressResult {
  /** runtime.run 的原始结果(status / duration / error / outputs 等) */
  result: WorkflowResult;
  /** 已成功加载的输出资产 */
  outputs: Asset[];
  /** 加载失败的输出资产 ID(getAsset 抛错,不静默丢弃,交调用方感知) */
  failedOutputIds: AssetId[];
}

/**
 * 执行工作流并经回调上报节点进度,返回结果与已加载的输出资产。
 *
 * 编排步骤:
 * 1. 若传 onNodeStatus,订阅 node:started/finished/failed → 归一后回调
 * 2. `await runtime.run(workflow, inputs)`
 * 3. 遍历 `result.outputs` 逐个 `runtime.getAsset(id)`,失败的收集到 failedOutputIds
 * 4. finally 卸载所有订阅(单个卸载异常隔离,不阻断后续)
 *
 * @param runtime  Lokvis Runtime 实例
 * @param workflow 已构建的 Workflow(调用方负责 buildLinearWorkflow 等构造)
 * @param inputs   输入资产(Asset[] 或 AssetId[])
 * @param options  可选:onNodeStatus 进度回调
 */
export async function runWithProgress(
  runtime: LokvisRuntime,
  workflow: Workflow,
  inputs: Asset[] | AssetId[],
  options: RunWithProgressOptions = {}
): Promise<RunWithProgressResult> {
  const { onNodeStatus } = options;
  const offs: Array<() => void> = [];

  if (onNodeStatus) {
    offs.push(
      runtime.eventBus.on('node:started', (e) =>
        onNodeStatus({ nodeId: e.nodeId, status: 'running' })
      )
    );
    offs.push(
      runtime.eventBus.on('node:finished', (e) =>
        onNodeStatus({ nodeId: e.nodeId, status: 'success', duration: e.duration })
      )
    );
    offs.push(
      runtime.eventBus.on('node:failed', (e) =>
        onNodeStatus({
          nodeId: e.nodeId,
          status: 'failed',
          error: e.error instanceof Error ? e.error.message : String(e.error),
        })
      )
    );
  }

  try {
    const result = await runtime.run(workflow, inputs);

    const outputs: Asset[] = [];
    const failedOutputIds: AssetId[] = [];
    for (const id of result.outputs) {
      try {
        outputs.push(await runtime.getAsset(id));
      } catch {
        // 加载失败不静默丢弃:收集 id 交调用方感知(如提示 N 个输出加载失败)
        failedOutputIds.push(id);
      }
    }

    return { result, outputs, failedOutputIds };
  } finally {
    for (const off of offs) {
      try {
        off();
      } catch {
        // 单个卸载异常不阻断后续(与 EventBus.emit 的 handler 隔离策略一致)
      }
    }
  }
}

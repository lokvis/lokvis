/**
 * Workflow Coordinator(W1.4 从 runtime.ts 抽取)
 *
 * 工作流执行协调器,封装 run / cancel / pause / resume / disposeWorkflow 与
 * status 状态机。run() 内部:validateWorkflow → historyManager 协调 →
 * executor.execute → status 更新 → historyManager.recordRunResult。
 *
 * deps 注入 executor / capabilityRegistry / eventBus / historyManager,
 * 不持有 Runtime 实例避免循环依赖。status 由本类持有,Runtime 通过 getter 查询。
 */

import type { Asset, AssetId } from '@lokvis/schema';
import type { Workflow, WorkflowResult } from '@lokvis/schema';
import { validateWorkflow, MAX_WORKFLOW_STEPS } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type { WorkflowExecutor } from '../executor.js';
import type { CapabilityRegistry } from '../capability-registry.js';
import type { HistoryManager } from './history-manager.js';
import type { RunOptions, RuntimeStatus } from '../types.js';

export interface WorkflowCoordinatorDeps {
  executor: WorkflowExecutor;
  capabilityRegistry: CapabilityRegistry;
  eventBus: EventBus;
  historyManager: HistoryManager;
}

/** 工作流执行协调器,由 RuntimeImpl 持有并委托 */
export class WorkflowCoordinator {
  private _status: RuntimeStatus = 'idle';

  constructor(private readonly deps: WorkflowCoordinatorDeps) {}

  get status(): RuntimeStatus {
    return this._status;
  }

  /**
   * 执行工作流:validateWorkflow → 历史栈准备 → executor.execute → 状态更新。
   *
   * Schema 层校验在 executor.execute 之前调用,让结构问题(保留字哨兵 __input__、
   * 悬挂 edge、自环、重复 id、真环)在入口处暴露,错误信息精准,而非被 executor
   * 拓扑排序误判为含糊的 "cycle"。三层防御的第 3 层(前两层:executor 防御性
   * 校验 + 单元测试覆盖)。
   *
   * W10.2/W10.3 增强:
   *   - resolveCapability 回调注入 capability 兼容性校验(相邻节点
   *     outputTypes 与 inputTypes 必须有交集;输入/输出节点类型与
   *     workflow.inputs/outputs.type 兼容)
   *   - maxSteps: 5(由 MAX_WORKFLOW_STEPS 常量定义,M1 MVP 约束)
   */
  async run(
    workflow: Workflow,
    inputs: AssetId[] | Asset[],
    options?: RunOptions
  ): Promise<WorkflowResult> {
    this._status = 'running';

    const validation = validateWorkflow(workflow, {
      maxSteps: MAX_WORKFLOW_STEPS,
      resolveCapability: (name) => {
        const cap = this.deps.capabilityRegistry.get(name);
        if (!cap) return undefined;
        return {
          inputTypes: cap.inputTypes,
          outputTypes: cap.outputTypes,
        };
      },
    });
    if (!validation.success) {
      this._status = 'error';
      const error = validation.error.issues.map((i) => i.message).join('; ');
      const result: WorkflowResult = {
        workflowId: workflow.id,
        outputs: [],
        duration: 0,
        status: 'failed',
        error,
      };
      this.deps.eventBus.emit({
        type: 'workflow:completed',
        workflowId: workflow.id,
        result,
      });
      return result;
    }

    // 历史栈管理(委托 HistoryManager):
    // - 默认:每次 run() 重置历史(重跑语义),并通过 onEvict 回收旧 outputs 资产
    // - appendHistory:true:保留已有历史栈,支持跨次 undo/redo 链(如连续滤镜)
    const inputIds = await this.collectInputAssetIds(inputs);
    this.deps.historyManager.prepareForRun(
      workflow.id,
      inputIds,
      options?.appendHistory ?? false
    );

    try {
      const result = await this.deps.executor.execute(workflow, inputs);
      this._status = result.status === 'failed' ? 'error' : 'idle';
      // 成功完成后,记录最终输出为当前
      if (result.status === 'completed') {
        this.deps.historyManager.recordRunResult(workflow.id, result.outputs);
      }
      return result;
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async cancel(workflowId: string): Promise<void> {
    return this.deps.executor.cancel(workflowId);
  }

  async pause(workflowId: string): Promise<void> {
    return this.deps.executor.pause(workflowId);
  }

  async resume(workflowId: string): Promise<void> {
    return this.deps.executor.resume(workflowId);
  }

  /**
   * 销毁指定工作流的运行时状态(W2.8 内存治理)。
   *
   * 调用时机:ui-react 卸载 Workspace 组件 / 用户关闭工作流标签页。
   * 行为:cancel 运行中执行 → historyManager.disposeHistory(reset 触发
   * onEvict → assetStore.remove 回收历史 outputs 资产)。
   *
   * 修复 review 报告:原实现无清理入口,Workflow 组件卸载后 Map 中残留 entry,
   * 长会话累积导致内存与 OPFS 空间双泄漏。
   */
  async disposeWorkflow(workflowId: string): Promise<void> {
    await this.deps.executor.cancel(workflowId).catch((err) => {
      // 工作流可能未在运行(常见情况,不抛错);其他真实错误(Worker 崩溃 /
      // executor 异常)只 warn 不阻断 dispose 流程,避免清理路径被卡住
      console.warn(
        `[lokvis] disposeWorkflow: cancel(${workflowId}) failed:`,
        err
      );
    });
    this.deps.historyManager.disposeHistory(workflowId);
  }

  /** 将输入归一化为 AssetId[](run() 入参可为 AssetId[] 或 Asset[]) */
  private async collectInputAssetIds(
    inputs: AssetId[] | Asset[]
  ): Promise<AssetId[]> {
    if (inputs.length === 0) return [];
    if (typeof inputs[0] === 'string') {
      return inputs as AssetId[];
    }
    return (inputs as Asset[]).map((a) => a.id);
  }
}

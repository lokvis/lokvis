/**
 * BatchScheduler - 批量作业调度与重试(W4.4 拆分)
 *
 * 职责:
 * - 调度循环:schedule 把 pending 项填入空闲槽位(ConcurrencyController)
 * - 项处理:processItem 导入 → run → 导出 output AssetId
 * - 失败重试:maxRetries 内回 pending,达上限标 failed
 * - 完成检测:maybeComplete
 * - cancel 竞态守卫(B1)
 *
 * 不持有 jobs Map(由 Facade 持有),通过参数接收 job。
 */
import type {
  AssetId,
  AssetSource,
  BatchItemStatus,
  BatchJobStatus,
  Workflow,
  WorkflowResult,
} from '@lokvis/schema';
import type { LokvisRuntime } from './types.js';
import type { BatchProgressEmitter } from './batch-progress.js';
import type { ConcurrencyController } from './concurrency-controller.js';

/** BatchItem 内部可变状态 */
export interface BatchItemInternal {
  id: string;
  index: number;
  status: BatchItemStatus;
  source: AssetSource;
  workflow: Workflow;
  /** 已导入的输入 asset(FO-04:视图暴露给 UI 侧做完成后清理) */
  inputAssetId?: AssetId;
  outputAssetId?: AssetId;
  error?: Error;
  attempts: number;
  maxRetries: number;
  duration?: number;
}

/** BatchJob 内部可变状态 */
export interface BatchJobInternal {
  id: string;
  status: BatchJobStatus;
  baseConcurrency: number;
  maxRetries: number;
  items: BatchItemInternal[];
  completed: number;
  failed: number;
  startedAt: number;
  endedAt?: number;
  scheduleLock: boolean;
  paused: boolean;
  cancelled: boolean;
}

/** 批量调度器:负责 job 的调度循环、项处理、重试与完成检测。 */
export class BatchScheduler {
  private readonly runtime: LokvisRuntime;
  private readonly progress: BatchProgressEmitter;
  private readonly concurrency: ConcurrencyController;

  constructor(opts: {
    runtime: LokvisRuntime;
    progress: BatchProgressEmitter;
    concurrency: ConcurrencyController;
  }) {
    this.runtime = opts.runtime;
    this.progress = opts.progress;
    this.concurrency = opts.concurrency;
  }

  /** 启动 job:发 batch:started,进入 running,触发首次 schedule */
  async runJob(job: BatchJobInternal): Promise<void> {
    if (job.cancelled) return;
    job.status = 'running';
    this.progress.emitStarted(job.id, job.items.length);
    await this.schedule(job);
  }

  /**
   * 调度循环:把 pending 项填入空闲槽位,直到无可用槽位或无 pending 项。
   * 重入保护:scheduleLock 防并发 schedule 超限。
   */
  async schedule(job: BatchJobInternal): Promise<void> {
    if (job.scheduleLock) return;
    if (job.cancelled || job.paused) return;
    if (this.isTerminal(job.status)) return;

    job.scheduleLock = true;
    try {
      while (!job.cancelled && !job.paused) {
        const running = job.items.filter((i) => i.status === 'processing').length;
        const cap = this.concurrency.current(job.baseConcurrency);
        if (running >= cap) break;

        const next = job.items.find((i) => i.status === 'pending');
        if (!next) break;

        next.status = 'processing';
        void this.processItem(job, next);
      }
      this.maybeComplete(job);
    } finally {
      job.scheduleLock = false;
    }
  }

  /** 处理单个项:导入 → run workflow → 导出 output AssetId */
  private async processItem(job: BatchJobInternal, item: BatchItemInternal): Promise<void> {
    const start = Date.now();
    const wfId = this.itemWorkflowId(job.id, item.id);
    this.progress.emitItemStarted(job.id, item.id, item.index, job.items.length);

    // B1:cancel 已同步标 item=cancelled,此处短路避免竞态
    if (job.cancelled || item.status === 'cancelled') return;

    let inputAssetId: AssetId | undefined;
    let result: WorkflowResult | undefined;
    try {
      inputAssetId = await this.runtime.importAsset(item.source);
      item.inputAssetId = inputAssetId;

      // B1:import 期间可能被 cancel
      if (job.cancelled) {
        item.status = 'cancelled';
        // TD-3.3: asset-store remove 已对 NotFoundError 静默忽略,此处 catch 到的
        // 都是真实错误,用 error 级别记录便于排查
        void this.runtime.removeAsset(inputAssetId).catch((err) => {
          console.error(`[lokvis] BatchProcessor: cleanup input(${inputAssetId}) on cancel failed:`, err);
        });
        item.inputAssetId = undefined;
        return;
      }

      const wf: Workflow = { ...item.workflow, id: wfId };
      result = await this.runtime.run(wf, [inputAssetId]);

      // B1:run 期间可能被 cancel
      if (job.cancelled) {
        item.status = 'cancelled';
        return;
      }

      if (result.status !== 'completed' || result.outputs.length === 0) {
        throw new Error(result.error || `Workflow ${result.status}`);
      }

      const outputAssetId = result.outputs[0]!;
      const duration = Date.now() - start;
      item.status = 'completed';
      item.outputAssetId = outputAssetId;
      item.duration = duration;
      job.completed++;
      this.progress.emitItemFinished(job.id, item.id, item.index, job.items.length, outputAssetId, duration);
      this.progress.emitProgress(job.id, job.completed, job.failed, job.items.length);
    } catch (err) {
      // B1:被 cancel 的 workflow 抛错不计入 failed
      if (job.cancelled) {
        item.status = 'cancelled';
        return;
      }
      item.attempts++;
      if (item.attempts <= item.maxRetries) {
        // 重试:回 pending(不重置 attempts),清理本次 input 避免孤儿累积
        item.status = 'pending';
        if (inputAssetId !== undefined) {
          void this.runtime.removeAsset(inputAssetId).catch((err) => {
            console.error(`[lokvis] BatchProcessor: cleanup input(${inputAssetId}) on retry failed:`, err);
          });
          item.inputAssetId = undefined;
        }
      } else {
        item.status = 'failed';
        item.error = err instanceof Error ? err : new Error(String(err));
        job.failed++;
        // M4:最终失败时清理 input asset
        if (inputAssetId !== undefined) {
          void this.runtime.removeAsset(inputAssetId).catch((err) => {
            console.error(`[lokvis] BatchProcessor: cleanup input(${inputAssetId}) on final fail failed:`, err);
          });
          item.inputAssetId = undefined;
        }
        this.progress.emitItemFailed(job.id, item.id, item.index, job.items.length, item.error, item.attempts);
        this.progress.emitProgress(job.id, job.completed, job.failed, job.items.length);
      }
    } finally {
      if (!job.cancelled && !job.paused && !this.isTerminal(job.status)) {
        void this.schedule(job);
      }
    }
  }

  /** 检查 job 是否全部完成,如是则发 batch:completed */
  maybeComplete(job: BatchJobInternal): void {
    if (this.isTerminal(job.status)) return;
    const pending = job.items.some((i) => i.status === 'pending' || i.status === 'processing');
    if (pending) return;

    job.endedAt = Date.now();
    job.status = job.failed > 0 ? 'failed' : 'completed';
    // 无论 completed 还是 failed 都发 batch:completed(waitForCompletion 依赖此行为)
    this.progress.emitCompleted(job.id, job.items.length, job.completed, job.failed, job.endedAt - job.startedAt);
    this.progress.cleanupJobSubs(job.id);
  }

  isTerminal(status: BatchJobStatus): boolean {
    return status === 'completed' || status === 'cancelled' || status === 'failed';
  }

  /** 派生每项的 workflow id(独立于其他项,便于 cancel) */
  itemWorkflowId(jobId: string, itemId: string): string {
    return `${jobId}__${itemId}`;
  }
}

/**
 * BatchProgressEmitter - 批量作业进度聚合与事件发射(W4.4 拆分)
 *
 * 职责:
 * - 托管批量公开接口(BatchProgress / BatchItemInput / BatchItem / BatchJob / EnqueueOptions)
 * - 管理 onProgress 订阅 + 发射所有 batch:* 事件
 * - waitForCompletion:事件等待 + 超时(泛型,不依赖 BatchJob)
 *
 * 设计原则:无状态,不持有 job 引用,所有数据通过参数传入。
 */
import type {
  AssetId,
  AssetSource,
  BatchItemStatus,
  BatchJobStatus,
  LokvisEvent,
  Workflow,
} from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';

/** 进度回调载荷 */
export interface BatchProgress {
  jobId: string;
  completed: number;
  failed: number;
  total: number;
}

/** 批量项输入(每个文件一个) */
export interface BatchItemInput {
  source: AssetSource;
  workflow: Workflow;
  maxRetries?: number;
}

/** 批量项运行时状态(对外只读视图) */
export interface BatchItem {
  id: string;
  index: number;
  status: BatchItemStatus;
  source: AssetSource;
  workflow: Workflow;
  /** 本项导入的输入 asset(FO-04:UI 侧完成后清理用) */
  inputAssetId?: AssetId;
  outputAssetId?: AssetId;
  error?: Error;
  attempts: number;
  maxRetries: number;
  duration?: number;
}

/** 批量作业运行时状态(对外只读视图) */
export interface BatchJob {
  id: string;
  status: BatchJobStatus;
  items: BatchItem[];
  completed: number;
  failed: number;
  total: number;
  startedAt: number;
  endedAt?: number;
}

/** enqueue 选项 */
export interface EnqueueOptions {
  items: BatchItemInput[];
  maxRetries?: number;
  concurrency?: number;
}

/** 批量进度发射器:统一管理 batch:* 事件与 progress 订阅。 */
export class BatchProgressEmitter {
  private readonly eventBus: EventBus;
  private readonly progressSubs = new Map<string, Set<(p: BatchProgress) => void>>();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** 订阅 job 进度(返回取消订阅函数) */
  onProgress(jobId: string, handler: (p: BatchProgress) => void): () => void {
    let subs = this.progressSubs.get(jobId);
    if (!subs) {
      subs = new Set();
      this.progressSubs.set(jobId, subs);
    }
    subs.add(handler);
    return () => {
      subs!.delete(handler);
      if (subs!.size === 0) this.progressSubs.delete(jobId);
    };
  }

  /** 发出 progress 事件 + 通知订阅者 */
  emitProgress(jobId: string, completed: number, failed: number, total: number): void {
    const payload: BatchProgress = { jobId, completed, failed, total };
    this.emit({ type: 'batch:progress', ...payload });
    const subs = this.progressSubs.get(jobId);
    if (subs) {
      // M1:遍历副本,防止 handler 内 unsubscribe mutate 正在迭代的 Set
      for (const fn of [...subs]) {
        try {
          fn(payload);
        } catch (err) {
          // 单个订阅者异常不阻断其他订阅者(与 event-bus.ts onAny 隔离策略一致)
          console.error(`[lokvis] batch-progress subscriber threw for job ${jobId}:`, err);
        }
      }
    }
  }

  emitStarted(jobId: string, total: number): void {
    this.emit({ type: 'batch:started', jobId, total });
  }

  emitItemStarted(jobId: string, itemId: string, index: number, total: number): void {
    this.emit({ type: 'batch:item:started', jobId, itemId, index, total });
  }

  emitItemFinished(
    jobId: string, itemId: string, index: number, total: number,
    outputAssetId: AssetId, duration: number
  ): void {
    this.emit({ type: 'batch:item:finished', jobId, itemId, index, total, outputAssetId, duration });
  }

  emitItemFailed(
    jobId: string, itemId: string, index: number, total: number,
    error: Error, attempts: number
  ): void {
    this.emit({ type: 'batch:item:failed', jobId, itemId, index, total, error, attempts });
  }

  /** batch:completed(无论 completed 还是 failed 状态都发此事件) */
  emitCompleted(
    jobId: string, total: number, completed: number, failed: number, duration: number
  ): void {
    this.emit({ type: 'batch:completed', jobId, total, completed, failed, duration });
  }

  emitCancelled(jobId: string, cancelled: number): void {
    this.emit({ type: 'batch:cancelled', jobId, cancelled });
  }

  emitPaused(jobId: string): void {
    this.emit({ type: 'batch:paused', jobId });
  }

  emitResumed(jobId: string): void {
    this.emit({ type: 'batch:resumed', jobId });
  }

  /** 清理 job 的所有进度订阅(终态时调用,避免泄漏) */
  cleanupJobSubs(jobId: string): void {
    this.progressSubs.delete(jobId);
  }

  /**
   * 等待 job 完成(completed/failed/cancelled 任一)。
   *
   * M5:timeoutMs 默认 5min,超时 reject + 调用 onTimeout(cancel job),避免坏 job
   * 永久挂起泄漏订阅。batch:completed 涵盖 failed(maybeComplete 对 failed>0 同样发),
   * 故只需监听 completed + cancelled。resolve 后立即解绑订阅。
   *
   * 泛型 T 不依赖 BatchJob,由调用方提供 resolveJob 回调构造视图。
   */
  async waitForCompletion<T>(
    jobId: string,
    opts: {
      timeoutMs?: number;
      isTerminal: () => boolean;
      resolveJob: () => T;
      onTimeout: () => Promise<void>;
    }
  ): Promise<T> {
    if (opts.isTerminal()) return opts.resolveJob();
    const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let offCompleted: () => void;
      let offCancelled: () => void;
      let timer: ReturnType<typeof setTimeout>;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        offCompleted();
        offCancelled();
        fn();
      };
      offCompleted = this.eventBus.on('batch:completed', (e) => {
        if (e.jobId !== jobId) return;
        finish(() => resolve(opts.resolveJob()));
      });
      offCancelled = this.eventBus.on('batch:cancelled', (e) => {
        if (e.jobId !== jobId) return;
        finish(() => resolve(opts.resolveJob()));
      });
      timer = setTimeout(() => {
        // 先 finish(reject + 取消订阅),再 onTimeout(cancel)。
        // 顺序重要:finish 内 offCancelled() 解除订阅,此后 cancel 触发的
        // batch:cancelled 不会被本 Promise 监听,避免抢先 resolve。
        finish(() =>
          reject(
            new Error(
              `BatchProcessor.waitForCompletion timed out after ${timeoutMs}ms (jobId=${jobId})`
            )
          )
        );
        void opts.onTimeout().catch((err) => {
          console.warn(
            `[lokvis] BatchProcessor: cancel(${jobId}) after timeout failed:`,
            err
          );
        });
      }, timeoutMs);
    });
  }

  /** 安全 emit(EventBus 异常不阻断批量逻辑) */
  private emit(event: LokvisEvent): void {
    try {
      this.eventBus.emit(event);
    } catch (err) {
      // EventBus 异常不阻断批量逻辑,但需记录便于调试
      console.warn(`[lokvis] batch-progress emit("${event.type}") threw:`, err);
    }
  }
}

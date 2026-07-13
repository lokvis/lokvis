/**
 * BatchProcessor - 批量作业处理器 Facade(W4.4 拆分后)
 *
 * 持有 jobs Map + 协作对象(BatchScheduler / BatchProgressEmitter / ConcurrencyController),
 * 对外保持原公开 API 不变。调度/重试/进度/并发 委托给协作对象;
 * Facade 保留 jobs Map 管理、批量上限校验、状态机控制、toJobView。
 */
import type { BatchItemStatus, EventBus } from '@lokvis/schema';
import type { LokvisRuntime } from './types.js';
import { MemoryGuard } from './memory-guard.js';
import {
  BatchProgressEmitter,
  type BatchJob,
  type EnqueueOptions,
  type BatchProgress,
} from './batch-progress.js';
import {
  FREE_CONCURRENCY,
  PRO_CONCURRENCY,
  ConcurrencyController,
} from './concurrency-controller.js';
import { BatchScheduler, type BatchJobInternal } from './batch-scheduler.js';

/** 批量上限超限错误(W6.2) */
export class BatchLimitExceededError extends Error {
  readonly limit: number;
  readonly requested: number;
  constructor(limit: number, requested: number) {
    super(
      `Batch limit exceeded: free tier allows up to ${limit} items, got ${requested}. ` +
        'Upgrade to Pro for unlimited batch processing.'
    );
    this.name = 'BatchLimitExceededError';
    this.limit = limit;
    this.requested = requested;
  }
}

/** 免费版批量上限(W6.2) */
export const FREE_BATCH_LIMIT = 10;
/** 终态 job 保留上限(超出按 FIFO 淘汰最旧) */
export const MAX_RETAINED_JOBS = 10;

export { FREE_CONCURRENCY, PRO_CONCURRENCY } from './concurrency-controller.js';
export type {
  BatchProgress,
  BatchItemInput,
  BatchItem,
  BatchJob,
  EnqueueOptions,
} from './batch-progress.js';

function generateItemId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `bi_${crypto.randomUUID()}`;
  }
  return `bi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateJobId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `batch_${crypto.randomUUID()}`;
  }
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** BatchProcessor Facade(不依赖 LokvisRuntimeImpl,通过构造注入接口) */
export class BatchProcessor {
  private readonly runtime: LokvisRuntime;
  private readonly isPro: boolean;
  private readonly jobs = new Map<string, BatchJobInternal>();
  private readonly scheduler: BatchScheduler;
  private readonly progress: BatchProgressEmitter;

  constructor(opts: {
    runtime: LokvisRuntime;
    eventBus: EventBus;
    isPro: boolean;
    memoryGuard?: MemoryGuard;
  }) {
    this.runtime = opts.runtime;
    this.isPro = opts.isPro;
    this.progress = new BatchProgressEmitter(opts.eventBus);
    const concurrency = new ConcurrencyController({ memoryGuard: opts.memoryGuard });
    this.scheduler = new BatchScheduler({
      runtime: opts.runtime,
      progress: this.progress,
      concurrency,
    });
  }

  enqueue(options: EnqueueOptions): BatchJob {
    const { items, maxRetries = 0, concurrency } = options;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('BatchProcessor.enqueue: items cannot be empty');
    }
    if (!this.isPro && items.length > FREE_BATCH_LIMIT) {
      throw new BatchLimitExceededError(FREE_BATCH_LIMIT, items.length);
    }
    const baseConcurrency =
      concurrency ?? (this.isPro ? PRO_CONCURRENCY : FREE_CONCURRENCY);
    const internal: BatchJobInternal = {
      id: generateJobId(),
      status: 'queued',
      baseConcurrency,
      maxRetries,
      items: items.map((input, index) => ({
        id: generateItemId(),
        index,
        status: 'pending' as BatchItemStatus,
        source: input.source,
        workflow: input.workflow,
        attempts: 0,
        maxRetries: input.maxRetries ?? maxRetries,
      })),
      completed: 0,
      failed: 0,
      startedAt: Date.now(),
      scheduleLock: false,
      paused: false,
      cancelled: false,
    };
    this.jobs.set(internal.id, internal);
    void this.scheduler.runJob(internal);
    return this.toJobView(internal);
  }

  list(): BatchJob[] {
    return Array.from(this.jobs.values()).map((j) => this.toJobView(j));
  }

  get(jobId: string): BatchJob | undefined {
    const internal = this.jobs.get(jobId);
    return internal ? this.toJobView(internal) : undefined;
  }

  async cancel(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    // m2: failed 也是终态,任何终态 job 不应被改写
    if (this.scheduler.isTerminal(job.status)) return;

    // B1:同步先标记 cancelled,使 in-flight processItem 续跑时短路
    job.cancelled = true;
    job.paused = false;
    let cancelledCount = 0;
    for (const item of job.items) {
      if (item.status === 'processing' || item.status === 'pending') {
        item.status = 'cancelled';
        cancelledCount++;
      }
    }
    for (const item of job.items) {
      if (item.status === 'cancelled') {
        const wfId = this.scheduler.itemWorkflowId(job.id, item.id);
        try {
          await this.runtime.cancel(wfId);
        } catch {
          // 取消失败不阻断
        }
      }
    }
    job.status = 'cancelled';
    job.endedAt = Date.now();
    this.progress.emitCancelled(jobId, cancelledCount);
    this.progress.cleanupJobSubs(jobId);
    this.pruneJobs();
  }

  async pause(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status !== 'running' && job.status !== 'queued') return;
    job.paused = true;
    job.status = 'paused';
    this.progress.emitPaused(jobId);
  }

  async resume(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status !== 'paused') return;
    job.paused = false;
    job.status = 'running';
    this.progress.emitResumed(jobId);
    void this.scheduler.schedule(job);
  }

  async retryFailed(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status !== 'failed' && job.status !== 'completed') return;
    for (const item of job.items) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
        item.error = undefined;
      }
    }
    job.failed = 0;
    job.cancelled = false;
    job.status = 'running';
    void this.scheduler.schedule(job);
  }

  onProgress(jobId: string, handler: (p: BatchProgress) => void): () => void {
    return this.progress.onProgress(jobId, handler);
  }

  async waitForCompletion(jobId: string, timeoutMs = 5 * 60 * 1000): Promise<BatchJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Batch job not found: ${jobId}`);
    return this.progress.waitForCompletion<BatchJob>(jobId, {
      timeoutMs,
      isTerminal: () => this.scheduler.isTerminal(job.status),
      resolveJob: () => this.toJobView(this.jobs.get(jobId) ?? job),
      onTimeout: () => this.cancel(jobId),
    });
  }

  private pruneJobs(): void {
    const terminal: BatchJobInternal[] = [];
    for (const job of this.jobs.values()) {
      if (this.scheduler.isTerminal(job.status)) terminal.push(job);
    }
    if (terminal.length <= MAX_RETAINED_JOBS) return;
    terminal.sort((a, b) => a.startedAt - b.startedAt);
    const removeCount = terminal.length - MAX_RETAINED_JOBS;
    for (let i = 0; i < removeCount; i++) {
      this.jobs.delete(terminal[i]!.id);
    }
  }

  private toJobView(job: BatchJobInternal): BatchJob {
    return {
      id: job.id,
      status: job.status,
      items: job.items.map((i) => ({ ...i })),
      completed: job.completed,
      failed: job.failed,
      total: job.items.length,
      startedAt: job.startedAt,
      endedAt: job.endedAt,
    };
  }
}

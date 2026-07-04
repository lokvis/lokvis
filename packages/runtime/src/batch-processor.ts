/**
 * BatchProcessor - 批量作业处理器(W6.1 + W6.2 + W6.3)
 *
 * 目标:把 W5 在 playground BatchQueue.tsx 里手写的"并发 4 池 + 进度 + 错误"
 * 逻辑下沉到 runtime,统一暴露给 SDK / MCP / UI 消费。
 *
 * 核心能力:
 * - 并发控制:基于槽位池,默认 4(Pro=16),按 MemoryGuard 压力动态收缩
 * - 失败重试:maxRetries(默认 0,与 W5 行为兼容);达到上限才发 batch:item:failed
 * - 批量上限:免费 10 文件(W6.2)、Pro 无限(超额抛 BatchLimitExceededError)
 * - 进度事件:batch:started / batch:item:* / batch:progress / batch:completed / batch:cancelled
 * - 取消:批量级 cancel,逐个取消 in-flight 项,已 pending 的标记 cancelled
 * - 暂停/恢复:挂起 schedule 循环(不取消 in-flight,完成后不再补满)
 *
 * 设计取舍:
 * - 不持久化作业状态(刷新即丢):W6 主要保证 Asset 持久化,批量队列是临时调度
 *   结构,刷新后由 UI 重新发起即可。持久化批量进度属 Phase 2。
 * - 不持有 output Blob:每项执行完即返回 AssetId,Blob 由 AssetStore(OPFS/IDB)托管,
 *   避免 50+ 图批量把 output Blob 全部留在内存导致 OOM。
 * - 单 Job 串行 schedule:同一 BatchProcessor 实例可并发 enqueue 多个 Job,但内部
 *   schedule 逻辑用 per-job lock 防重入(参考 W5 BatchQueue 的 scheduleLock 修复)。
 *
 * @example
 * ```ts
 * const job = runtime.batch.enqueue({
 *   items: files.map((f) => ({ source: { kind: 'file', file: f }, workflow: wf })),
 *   maxRetries: 1,
 * });
 * runtime.batch.onProgress(job.id, (p) => console.log(p.completed, '/', p.total));
 * await runtime.batch.waitForCompletion(job.id);
 * ```
 */
import type {
  AssetId,
  AssetSource,
  BatchItemStatus,
  BatchJobStatus,
  LokvisEvent,
  Workflow,
  WorkflowResult,
} from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';
import type { LokvisRuntime } from './types.js';
import { MemoryGuard, type MemoryPressure } from './memory-guard.js';

/** 批量项输入(每个文件一个) */
export interface BatchItemInput {
  /**
   * 资产来源:通常为 { kind: 'file', file }(用户拖入),也可为 blob/url。
   * BatchProcessor 在执行前调 runtime.importAsset(source) 导入为 AssetId。
   */
  source: AssetSource;
  /** 该项要执行的工作流(每个文件独立 workflow 实例,便于独立 cancel) */
  workflow: Workflow;
  /** 该项最大重试次数(覆盖 job 级 maxRetries) */
  maxRetries?: number;
}

/** 批量项运行时状态(对外只读视图) */
export interface BatchItem {
  /** 项 ID(自动生成,用于事件追踪与 UI 定位) */
  id: string;
  /** 在 job 中的序号(0-based,用于事件中的 index 字段) */
  index: number;
  status: BatchItemStatus;
  /** 输入 source(便于失败时 UI 展示文件名) */
  source: AssetSource;
  /** 该项执行的工作流 */
  workflow: Workflow;
  /** 输出 AssetId(completed 时填) */
  outputAssetId?: AssetId;
  /** 失败原因(failed 时填) */
  error?: Error;
  /** 已重试次数 */
  attempts: number;
  /** 该项最大重试次数 */
  maxRetries: number;
  /** 单项执行耗时(ms,completed 时填) */
  duration?: number;
}

/** 批量作业运行时状态(对外只读视图) */
export interface BatchJob {
  id: string;
  status: BatchJobStatus;
  items: BatchItem[];
  /** 已完成数(completed) */
  completed: number;
  /** 失败数(failed) */
  failed: number;
  /** 总项数 */
  total: number;
  /** job 起始时间(ms) */
  startedAt: number;
  /** job 结束时间(ms,完成后填) */
  endedAt?: number;
}

/** enqueue 选项 */
export interface EnqueueOptions {
  /** 作业项 */
  items: BatchItemInput[];
  /** job 级最大重试次数(默认 0,单项可 BatchItemInput.maxRetries 覆盖) */
  maxRetries?: number;
  /**
   * 并发槽位上限(默认按 isPro:free=4,pro=16)。
   * 实际并发会按 MemoryGuard 压力动态收缩。
   */
  concurrency?: number;
}

/** 进度回调载荷 */
export interface BatchProgress {
  jobId: string;
  completed: number;
  failed: number;
  total: number;
}

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

/** 默认并发槽位 */
export const FREE_CONCURRENCY = 4;
export const PRO_CONCURRENCY = 16;

/** 按 MemoryPressure 收缩并发槽位 */
function shrinkConcurrencyByPressure(
  base: number,
  pressure: MemoryPressure
): number {
  switch (pressure) {
    case 'critical':
      return 1;
    case 'high':
      return Math.max(1, Math.floor(base / 2));
    case 'elevated':
      return Math.max(2, Math.floor((base * 3) / 4));
    default:
      return base;
  }
}

/** 生成项 ID */
function generateItemId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `bi_${crypto.randomUUID()}`;
  }
  return `bi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 生成 job ID */
function generateJobId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `batch_${crypto.randomUUID()}`;
  }
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * BatchProcessor 实现。
 *
 * 不直接依赖 LokvisRuntimeImpl(避免循环引用),通过构造注入 LokvisRuntime 接口。
 * 内部用纯 JS Map 管理作业,无 React state(可被 SDK / MCP / Node 复用)。
 */
export class BatchProcessor {
  private readonly runtime: LokvisRuntime;
  private readonly eventBus: EventBus;
  private readonly isPro: boolean;
  private readonly memoryGuard?: MemoryGuard;
  /** jobId → BatchJob 内部可变状态(含 private 字段) */
  private readonly jobs = new Map<string, BatchJobInternal>();
  /** 进度回调订阅 */
  private readonly progressSubs = new Map<string, Set<(p: BatchProgress) => void>>();

  constructor(opts: {
    runtime: LokvisRuntime;
    eventBus: EventBus;
    isPro: boolean;
    memoryGuard?: MemoryGuard;
  }) {
    this.runtime = opts.runtime;
    this.eventBus = opts.eventBus;
    this.isPro = opts.isPro;
    this.memoryGuard = opts.memoryGuard;
  }

  /**
   * 入队批量作业。返回 job 视图(只读)。
   * 超过免费上限时同步抛 BatchLimitExceededError,不创建 job。
   * 空 items 抛错(避免静默产出 0 项 completed job,遮蔽调用方逻辑错误)。
   */
  enqueue(options: EnqueueOptions): BatchJob {
    const { items, maxRetries = 0, concurrency } = options;

    // m3: 空数组视为调用方逻辑错误,显式抛错而非静默完成
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('BatchProcessor.enqueue: items cannot be empty');
    }

    // W6.2 批量上限:免费 10,Pro 无限
    if (!this.isPro && items.length > FREE_BATCH_LIMIT) {
      throw new BatchLimitExceededError(FREE_BATCH_LIMIT, items.length);
    }

    const jobId = generateJobId();
    const baseConcurrency =
      concurrency ?? (this.isPro ? PRO_CONCURRENCY : FREE_CONCURRENCY);

    const internal: BatchJobInternal = {
      id: jobId,
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
      /** schedule 重入锁(参考 W5 BatchQueue scheduleLock 修复) */
      scheduleLock: false,
      /** pause 时 schedule 不再补满新项 */
      paused: false,
      /** cancel 标记:已发起 cancel 后所有 pending → cancelled,schedule 终止 */
      cancelled: false,
    };
    this.jobs.set(jobId, internal);

    // 异步启动(不阻塞 enqueue 调用方)
    void this.runJob(internal);

    return this.toJobView(internal);
  }

  /** 列出所有作业(只读视图) */
  list(): BatchJob[] {
    return Array.from(this.jobs.values()).map((j) => this.toJobView(j));
  }

  /** 获取指定 job */
  get(jobId: string): BatchJob | undefined {
    const internal = this.jobs.get(jobId);
    return internal ? this.toJobView(internal) : undefined;
  }

  /** 取消整个 job:逐个取消 in-flight 项,pending 项标记 cancelled */
  async cancel(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    // m2: failed 也是终态,任何终态 job 不应被改写
    if (this.isTerminal(job.status)) return;

    // B1 修复:同步先标记 cancelled,使 in-flight processItem 续跑时读到
    // cancelled=true 后短路,避免覆盖 cancelled 状态或把被取消的项误标 failed。
    job.cancelled = true;
    job.paused = false;
    let cancelledCount = 0;

    // 同步把所有 processing/pending 项标记 cancelled(processItem 续跑会读到此状态)
    for (const item of job.items) {
      if (item.status === 'processing' || item.status === 'pending') {
        item.status = 'cancelled';
        cancelledCount++;
      }
    }

    // 异步取消所有 in-flight workflow(此时项状态已是 cancelled,
    // processItem 续跑会因 job.cancelled 短路,不会回写其他状态)
    for (const item of job.items) {
      if (item.status === 'cancelled') {
        const wfId = this.itemWorkflowId(job.id, item.id);
        try {
          await this.runtime.cancel(wfId);
        } catch {
          // 取消失败不阻断,继续取消其他项
        }
      }
    }

    job.status = 'cancelled';
    job.endedAt = Date.now();
    this.emit({ type: 'batch:cancelled', jobId, cancelled: cancelledCount });
    this.cleanupJobSubs(jobId);
  }

  /** 暂停 job:schedule 不再补满,已 in-flight 项跑完即止 */
  async pause(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status !== 'running' && job.status !== 'queued') return;
    job.paused = true;
    job.status = 'paused';
    // m1: 发 pause 事件,UI 可订阅无需轮询
    this.emit({ type: 'batch:paused', jobId });
  }

  /** 恢复 job:解除 pause,schedule 继续补满 */
  async resume(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status !== 'paused') return;
    job.paused = false;
    job.status = 'running';
    // m1: 发 resumed 事件
    this.emit({ type: 'batch:resumed', jobId });
    void this.schedule(job);
  }

  /**
   * 重试 job 中所有 failed 项(仅当 job 已结束)。
   * 重置 attempts/error/status,pending 重新等待 schedule。
   */
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
    void this.schedule(job);
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

  /**
   * 等待 job 完成(completed/failed/cancelled 任一)。
   *
   * M5 修复:
   * - 增加 timeoutMs(默认 5min),超时 reject,避免坏 job 永久挂起泄漏订阅
   * - batch:completed 事件已涵盖 failed(maybeComplete 对 failed>0 的 job
   *   同样发 batch:completed),故只需监听 completed + cancelled
   * - resolve 后立即解绑所有订阅,避免调用方丢弃 promise 时泄漏
   * - cancel/maybeComplete 进入终态时也会 cleanupJobSubs 兜底
   */
  async waitForCompletion(
    jobId: string,
    timeoutMs = 5 * 60 * 1000
  ): Promise<BatchJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Batch job not found: ${jobId}`);
    if (this.isTerminal(job.status)) return this.toJobView(job);

    return new Promise<BatchJob>((resolve, reject) => {
      let settled = false;
      // 声明在前,finish 与各 handler 互相引用
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
        finish(() => resolve(this.toJobView(this.jobs.get(jobId) ?? job)));
      });
      offCancelled = this.eventBus.on('batch:cancelled', (e) => {
        if (e.jobId !== jobId) return;
        finish(() => resolve(this.toJobView(this.jobs.get(jobId) ?? job)));
      });
      timer = setTimeout(() => {
        finish(() =>
          reject(
            new Error(
              `BatchProcessor.waitForCompletion timed out after ${timeoutMs}ms (jobId=${jobId})`
            )
          )
        );
      }, timeoutMs);
    });
  }

  /** 清理 job 的所有进度订阅(终态时调用,避免泄漏) */
  private cleanupJobSubs(jobId: string): void {
    this.progressSubs.delete(jobId);
  }

  // ─── 内部实现 ────────────────────────────────────────

  /** 启动 job:发 batch:started,进入 running,触发首次 schedule */
  private async runJob(job: BatchJobInternal): Promise<void> {
    if (job.cancelled) return;
    job.status = 'running';
    this.emit({ type: 'batch:started', jobId: job.id, total: job.items.length });
    await this.schedule(job);
  }

  /**
   * 调度循环:把 pending 项填入空闲槽位,直到无可用槽位或无 pending 项。
   *
   * 重入保护:用 scheduleLock 防止多个 schedule 调用并发导致超限(参考 W5
   * BatchQueue.tsx 的 scheduleLock 修复:并发完成时多个 processItem 同时触发
   * schedule 会读到相同 running 快照,导致并发超限)。
   */
  private async schedule(job: BatchJobInternal): Promise<void> {
    if (job.scheduleLock) return;
    if (job.cancelled || job.paused) return;
    if (this.isTerminal(job.status)) return;

    job.scheduleLock = true;
    try {
      while (!job.cancelled && !job.paused) {
        const running = job.items.filter((i) => i.status === 'processing').length;
        const cap = this.currentConcurrency(job);
        if (running >= cap) break;

        const next = job.items.find((i) => i.status === 'pending');
        if (!next) break;

        // 标记 processing 并启动(不 await,让循环继续补满)
        next.status = 'processing';
        void this.processItem(job, next);
      }

      // 循环结束:检查是否所有项都已终结
      this.maybeComplete(job);
    } finally {
      job.scheduleLock = false;
    }
  }

  /** 处理单个项:导入 → run workflow → 导出 output AssetId */
  private async processItem(
    job: BatchJobInternal,
    item: BatchItemInternal
  ): Promise<void> {
    const start = Date.now();
    const wfId = this.itemWorkflowId(job.id, item.id);

    this.emit({
      type: 'batch:item:started',
      jobId: job.id,
      itemId: item.id,
      index: item.index,
      total: job.items.length,
    });

    // B1 修复:cancel 已同步把 item 标为 cancelled,此处若发现 cancelled
    // 直接短路,不发起 import/run,避免与 cancel 竞态
    if (job.cancelled || item.status === 'cancelled') {
      return;
    }

    let inputAssetId: AssetId | undefined;
    let result: WorkflowResult | undefined;
    try {
      // 1. 导入输入资产
      inputAssetId = await this.runtime.importAsset(item.source);

      // B1 守卫:import 期间可能被 cancel
      if (job.cancelled) {
        item.status = 'cancelled';
        // 清理刚导入的 input,避免孤儿资产(cancel 期间产出的 input 不应残留)
        void this.runtime.removeAsset(inputAssetId).catch(() => {});
        return;
      }

      // 2. 执行工作流(用独立 workflow id,便于 cancel)
      const wf: Workflow = { ...item.workflow, id: wfId };
      result = await this.runtime.run(wf, [inputAssetId]);

      // B1 守卫:run 期间可能被 cancel(cancel 已同步标 item=cancelled)
      if (job.cancelled) {
        item.status = 'cancelled';
        return;
      }

      if (result.status !== 'completed' || result.outputs.length === 0) {
        throw new Error(result.error || `Workflow ${result.status}`);
      }

      const outputAssetId = result.outputs[0]!;
      const duration = Date.now() - start;

      // 成功
      item.status = 'completed';
      item.outputAssetId = outputAssetId;
      item.duration = duration;
      job.completed++;

      this.emit({
        type: 'batch:item:finished',
        jobId: job.id,
        itemId: item.id,
        index: item.index,
        total: job.items.length,
        outputAssetId,
        duration,
      });
      this.emitProgress(job);
    } catch (err) {
      // B1 守卫:被 cancel 的 workflow 抛错不计入 failed(item 已是 cancelled)
      if (job.cancelled) {
        item.status = 'cancelled';
        return;
      }
      // 失败:判断是否还可重试
      item.attempts++;
      const maxRetries = item.maxRetries;
      if (item.attempts <= maxRetries) {
        // 重试:回 pending,schedule 会再次拉起
        item.status = 'pending';
        // 注意:不重置 attempts,保留累计重试次数
        // 清理本次导入的 input asset,避免重试重新 import 时旧 input 成为孤儿
        // (Blocker 修复:maxRetries=3 全失败原本会累积 3 个孤儿 input)
        if (inputAssetId !== undefined) {
          void this.runtime.removeAsset(inputAssetId).catch(() => {});
        }
      } else {
        item.status = 'failed';
        item.error = err instanceof Error ? err : new Error(String(err));
        job.failed++;
        // M4:最终失败时清理已导入的 input asset,避免批量失败累积孤儿资产
        // 占用 OPFS/IDB 空间并污染 listAssets / StatusBar 配额
        if (inputAssetId !== undefined) {
          void this.runtime.removeAsset(inputAssetId).catch(() => {});
        }
        this.emit({
          type: 'batch:item:failed',
          jobId: job.id,
          itemId: item.id,
          index: item.index,
          total: job.items.length,
          error: item.error,
          attempts: item.attempts,
        });
        this.emitProgress(job);
      }
    } finally {
      // 触发 schedule 补满(用 ref 打破循环依赖)
      if (!job.cancelled && !job.paused && !this.isTerminal(job.status)) {
        void this.schedule(job);
      }
    }
  }

  /** 当前并发槽位(按内存压力动态收缩) */
  private currentConcurrency(job: BatchJobInternal): number {
    const pressure = this.memoryGuard?.getPressure() ?? 'low';
    return shrinkConcurrencyByPressure(job.baseConcurrency, pressure);
  }

  /** 发出 progress 事件 + 通知订阅者 */
  private emitProgress(job: BatchJobInternal): void {
    const payload: BatchProgress = {
      jobId: job.id,
      completed: job.completed,
      failed: job.failed,
      total: job.items.length,
    };
    this.emit({
      type: 'batch:progress',
      ...payload,
    });
    const subs = this.progressSubs.get(job.id);
    if (subs) {
      // M1 修复:遍历副本,防止 handler 内 unsubscribe/subscribe mutate 正在迭代的 Set
      for (const fn of [...subs]) {
        try {
          fn(payload);
        } catch {
          // 单个订阅者异常不阻断其他订阅者
        }
      }
    }
  }

  /** 检查 job 是否全部完成,如是则发 batch:completed */
  private maybeComplete(job: BatchJobInternal): void {
    if (this.isTerminal(job.status)) return;
    const pending = job.items.some(
      (i) => i.status === 'pending' || i.status === 'processing'
    );
    if (pending) return;

    job.endedAt = Date.now();
    job.status = job.failed > 0 ? 'failed' : 'completed';
    // 注意:无论 job.status 是 'completed' 还是 'failed',都发 batch:completed 事件。
    // 事件名表示"所有项已终结(含部分失败)",而非"全部成功"。
    // 消费方应通过 payload.failed 区分;waitForCompletion 依赖此行为(只监听
    // batch:completed + batch:cancelled 两种终态事件)。
    this.emit({
      type: 'batch:completed',
      jobId: job.id,
      total: job.items.length,
      completed: job.completed,
      failed: job.failed,
      duration: job.endedAt - job.startedAt,
    });
    // M5:进入终态清理进度订阅,避免 waitForCompletion 调用方丢弃 promise 后泄漏
    this.cleanupJobSubs(job.id);
  }

  private isTerminal(status: BatchJobStatus): boolean {
    return (
      status === 'completed' ||
      status === 'cancelled' ||
      status === 'failed'
    );
  }

  /** 派生每项的 workflow id(独立于其他项,便于 cancel) */
  private itemWorkflowId(jobId: string, itemId: string): string {
    return `${jobId}__${itemId}`;
  }

  /** 安全 emit(无 EventBus 时降级为 no-op,便于纯单元测试) */
  private emit(event: LokvisEvent): void {
    try {
      this.eventBus.emit(event);
    } catch {
      // EventBus 异常不阻断批量逻辑
    }
  }

  /** 内部可变状态 → 对外只读视图(浅拷贝 items 数组与每项) */
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

/** BatchJob 内部可变状态(BatchProcessor 私有) */
interface BatchJobInternal {
  id: string;
  status: BatchJobStatus;
  baseConcurrency: number;
  maxRetries: number;
  items: BatchItemInternal[];
  completed: number;
  failed: number;
  startedAt: number;
  endedAt?: number;
  /** schedule 重入锁 */
  scheduleLock: boolean;
  paused: boolean;
  cancelled: boolean;
}

/** BatchItem 内部可变状态 */
interface BatchItemInternal extends Omit<BatchItem, 'outputAssetId' | 'error' | 'duration'> {
  outputAssetId?: AssetId;
  error?: Error;
  duration?: number;
}

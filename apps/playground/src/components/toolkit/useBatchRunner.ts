/**
 * FO-04 · 批量调度共享 hook
 *
 * 取代 BatchQueue / WatermarkBatchTool 此前各自手写的并发池
 * （CONCURRENCY=4 硬编码），把调度委托给 runtime.batch（BatchProcessor）：
 *   - 并发随 plan 取值（free=FREE_CONCURRENCY / pro=PRO_CONCURRENCY），
 *     并随 MemoryGuard 内存压力动态收缩
 *   - 免费版批量上限由 enqueue 抛 BatchLimitExceededError 强制（runtime 侧执行，
 *     不再靠组件自查）
 *   - 逐文件状态由 batch:* 事件订阅驱动，UI 保留 per-file 状态机
 *
 * 资产生命周期（承接 W7.6 review 修复）：每项 export 完成后立即清理
 * input/output asset 并 disposeWorkflow，避免长批量任务累积 OPFS/IDB
 * 与 historyStacks Map 占用；下载用内存中的 outputBlob。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LokvisRuntime, Workflow } from '@lokvis/sdk';
import { BatchLimitExceededError } from '@lokvis/runtime';

export type BatchRunnerStatus = 'pending' | 'processing' | 'done' | 'error';

export interface BatchRunnerItem {
  id: string;
  file: File;
  inputSize: number;
  status: BatchRunnerStatus;
  outputBlob?: Blob;
  outputSize?: number;
  error?: string;
}

export type ProcessAllResult = 'ok' | 'not-ready' | 'limit';

export interface UseBatchRunnerOptions {
  runtime: LokvisRuntime | null;
  /** 构造每项的 workflow（enqueue 时捕获当前参数） */
  buildWorkflow: (item: BatchRunnerItem) => Workflow;
}

export interface UseBatchRunnerResult {
  queue: BatchRunnerItem[];
  /** 是否有运行中的批量作业 */
  processing: boolean;
  addFiles(files: File[]): void;
  /** 提交所有 pending 项；'limit'=免费批量上限，'not-ready'=runtime 未就绪 */
  processAll(): Promise<ProcessAllResult>;
  /** 取消运行中的作业（被取消项回退 pending，可重新处理） */
  cancel(): Promise<void>;
  /** 清空队列（运行中则先取消） */
  clear(): Promise<void>;
}

let idSeq = 0;
const nextId = () => `br-${Date.now()}-${(idSeq++).toString(36)}`;

export function useBatchRunner({
  runtime,
  buildWorkflow,
}: UseBatchRunnerOptions): UseBatchRunnerResult {
  const [queue, setQueue] = useState<BatchRunnerItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const queueRef = useRef<BatchRunnerItem[]>([]);
  const runtimeRef = useRef(runtime);
  const activeJobIdRef = useRef<string | null>(null);
  /** 批量项 index → 队列 item id（enqueue 时按 pending 顺序建立） */
  const indexToItemIdRef = useRef<Map<number, string>>(new Map());
  const buildWorkflowRef = useRef(buildWorkflow);
  const mountedRef = useRef(true);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);
  useEffect(() => {
    buildWorkflowRef.current = buildWorkflow;
  }, [buildWorkflow]);

  const commit = useCallback((next: BatchRunnerItem[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const patchItem = useCallback(
    (id: string, patch: Partial<BatchRunnerItem>) => {
      commit(queueRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [commit]
  );

  // batch:* 事件订阅：驱动逐文件状态。runtime 变化（plan 切换重建）时，
  // 旧 runtime 被 cancel('all') 且事件不再触达，processing 统一回退 pending。
  useEffect(() => {
    const rt = runtime;
    activeJobIdRef.current = null;
    indexToItemIdRef.current.clear();
    setProcessing(false);
    if (!rt) return;
    commit(
      queueRef.current.map((it) =>
        it.status === 'processing' ? { ...it, status: 'pending' as BatchRunnerStatus } : it
      )
    );

    const isMine = (jobId: string) => activeJobIdRef.current === jobId;
    const itemIdAt = (index: number) => indexToItemIdRef.current.get(index);

    const handleFinished = async (
      jobId: string,
      itemId: string,
      index: number,
      outputAssetId: string
    ) => {
      const id = itemIdAt(index);
      if (!id) return;
      try {
        const blob = await rt.exportAsset(outputAssetId);
        if (!mountedRef.current) return;
        patchItem(id, { status: 'done', outputBlob: blob, outputSize: blob.size });
      } catch (err) {
        if (!mountedRef.current) return;
        patchItem(id, {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
      // 资产清理：下载用内存 blob，asset 不再需要（input 可能已被 scheduler
      // 在 retry/fail/cancel 路径清理，asset-store remove 对 not-found 静默）
      const batchItem = rt.batch.get(jobId)?.items[index];
      await rt.removeAsset(outputAssetId).catch((err) => {
        console.warn('[lokvis] useBatchRunner: removeAsset(output) failed:', err);
      });
      if (batchItem?.inputAssetId) {
        await rt.removeAsset(batchItem.inputAssetId).catch((err) => {
          console.warn('[lokvis] useBatchRunner: removeAsset(input) failed:', err);
        });
      }
      await rt.disposeWorkflow(rt.batch.workflowIdFor(jobId, itemId)).catch((err) => {
        console.warn('[lokvis] useBatchRunner: disposeWorkflow failed:', err);
      });
    };

    const offItemStarted = rt.eventBus.on('batch:item:started', (e) => {
      if (!isMine(e.jobId)) return;
      const id = itemIdAt(e.index);
      if (id) patchItem(id, { status: 'processing' });
    });
    const offItemFinished = rt.eventBus.on('batch:item:finished', (e) => {
      if (!isMine(e.jobId)) return;
      void handleFinished(e.jobId, e.itemId, e.index, e.outputAssetId);
    });
    const offItemFailed = rt.eventBus.on('batch:item:failed', (e) => {
      if (!isMine(e.jobId)) return;
      const id = itemIdAt(e.index);
      if (id) patchItem(id, { status: 'error', error: e.error.message });
    });
    const offCompleted = rt.eventBus.on('batch:completed', (e) => {
      if (!isMine(e.jobId)) return;
      activeJobIdRef.current = null;
      indexToItemIdRef.current.clear();
      setProcessing(false);
    });
    const offCancelled = rt.eventBus.on('batch:cancelled', (e) => {
      if (!isMine(e.jobId)) return;
      activeJobIdRef.current = null;
      indexToItemIdRef.current.clear();
      setProcessing(false);
      // 被取消项的 input asset 清理（scheduler 仅清理 import 中被取消的项）
      const job = rt.batch.get(e.jobId);
      for (const bi of job?.items ?? []) {
        if (bi.inputAssetId) {
          void rt.removeAsset(bi.inputAssetId).catch((err) => {
            console.warn('[lokvis] useBatchRunner: removeAsset(cancelled input) failed:', err);
          });
        }
      }
      // 回退 pending：用户可重新点「处理」重启（原 WatermarkBatchTool 语义）
      commit(
        queueRef.current.map((it) =>
          it.status === 'processing' ? { ...it, status: 'pending' as BatchRunnerStatus } : it
        )
      );
    });

    return () => {
      offItemStarted();
      offItemFinished();
      offItemFailed();
      offCompleted();
      offCancelled();
    };
  }, [runtime, commit, patchItem]);

  // W21.6：unmount 时取消运行中的作业，防止后台继续执行（Worker + 内存泄漏）
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const rt = runtimeRef.current;
      const jobId = activeJobIdRef.current;
      if (rt && jobId) {
        void rt.batch.cancel(jobId).catch((err) => {
          console.warn('[lokvis] useBatchRunner: unmount cancel failed:', err);
        });
      }
    };
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const newItems: BatchRunnerItem[] = files.map((file) => ({
        id: nextId(),
        file,
        inputSize: file.size,
        status: 'pending',
      }));
      commit([...queueRef.current, ...newItems]);
    },
    [commit]
  );

  const processAll = useCallback(async (): Promise<ProcessAllResult> => {
    const rt = runtimeRef.current;
    if (!rt) return 'not-ready';
    const pending = queueRef.current.filter((i) => i.status === 'pending');
    if (pending.length === 0) return 'ok';
    const items = pending.map((it) => ({
      source: { kind: 'file' as const, file: it.file },
      workflow: buildWorkflowRef.current(it),
    }));
    let jobId: string;
    try {
      jobId = rt.batch.enqueue({ items }).id;
    } catch (err) {
      if (err instanceof BatchLimitExceededError) return 'limit';
      throw err;
    }
    activeJobIdRef.current = jobId;
    indexToItemIdRef.current = new Map(pending.map((it, i) => [i, it.id]));
    setProcessing(true);
    // enqueue 同步窗口内首批项已进入 processing（item:started 事件先于映射建立），
    // 从 job 视图补一次状态，避免 UI 停在 pending
    const view = rt.batch.get(jobId);
    for (const bi of view?.items ?? []) {
      if (bi.status !== 'processing') continue;
      const id = indexToItemIdRef.current.get(bi.index);
      if (id) patchItem(id, { status: 'processing' });
    }
    return 'ok';
  }, [patchItem]);

  const cancel = useCallback(async () => {
    const rt = runtimeRef.current;
    const jobId = activeJobIdRef.current;
    if (!rt || !jobId) return;
    await rt.batch.cancel(jobId);
  }, []);

  const clear = useCallback(async () => {
    await cancel();
    indexToItemIdRef.current.clear();
    commit([]);
  }, [cancel, commit]);

  return { queue, processing, addFiles, processAll, cancel, clear };
}

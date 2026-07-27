/**
 * useImageBatch — 批量图片处理的纯逻辑 hook(Layer 0),无 UI。
 *
 * 面向"多文件 + 同一能力 + 参数可整体调整"的批处理场景(如 QuickResizeTool
 * 的批量缩放)。与单图 hook(useImageResize / useImageCompress)的区别:
 *   - 自持 runtime(不复用 useImageTool),独立管理一组 BatchItem 的生命周期
 *   - 顺序调度:任一时刻最多一个 item 处于 processing,避免并发导入/执行
 *     造成的内存峰值与 OPFS 写入竞争
 *   - 参数以 buildParams(info) 按 item 计算(支持 resize 'half' 等依赖
 *     inputInfo 的预设);paramsKey 变化时整批(非 processing)重置重跑
 *   - 单 item 失败只落在 item.error,不中断后续 item;hook 级仅有 initError
 *
 * ObjectURL 生命周期:inputUrl 在 addFiles 时 createObjectURL,在
 * removeItem / reset / unmount 时统一 revoke,避免泄漏。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { PluginLoadEntry } from '@lokvis/sdk';
import { useLokvisRuntime } from '../internal/useLokvisRuntime';
import { buildSingleStepImageWorkflow } from '../internal/workflow-builder';
import { getImageInfo, type ImageInfo } from '../internal/download';

/** 批量处理中的单个文件条目 */
export interface BatchItem {
  /** 唯一键:`${name}-${size}-${lastModified}-${序号}`,供 removeItem / React key 使用 */
  key: string;
  /** 原始输入文件 */
  file: File;
  /** 输入预览 URL(createObjectURL;remove/reset/unmount 时 revoke) */
  inputUrl: string;
  /** 输入图片信息(处理时读取;读取失败为 null) */
  inputInfo: ImageInfo | null;
  /** 处理状态 */
  status: 'queued' | 'processing' | 'done' | 'error';
  /** 输出 Blob(完成后填充) */
  outputBlob: Blob | null;
  /** 输出图片信息(完成后填充) */
  outputInfo: ImageInfo | null;
  /** 单 item 失败信息(仅 error 状态非空) */
  error: string | null;
}

/** 整批完成回调的统计摘要(埋点用) */
export interface BatchSummary {
  total: number;
  done: number;
  failed: number;
  inputBytes: number;
  outputBytes: number;
}

export interface UseImageBatchOptions {
  /** 处理能力名(常用:'image.resize' / 'image.compress') */
  capability: 'image.resize' | 'image.compress' | string;
  /**
   * 按 item 计算 workflow 参数。入参为该 item 的 inputInfo(可能为 null),
   * 以支持 resize 'half' 等依赖原图尺寸的预设。每次执行时经 ref 读取最新闭包。
   */
  buildParams: (info: ImageInfo | null) => Record<string, unknown>;
  /**
   * 参数指纹。变化时把所有非 processing 的 item 重置为 queued 并重跑
   * (正在处理的 item 用旧参数跑完,不中断)。
   */
  paramsKey: string;
  /** 整批完成回调(埋点用):所有 item 离开 queued/processing 时触发一次 */
  onBatchComplete?: (summary: BatchSummary) => void;
  /**
   * 预加载插件列表(W23)。透传给底层 useLokvisRuntime,与其他 hook 一致。
   * - undefined(默认):使用 [imageToolsPlugin()](向后兼容)
   * - []:显式不加载任何插件
   */
  plugins?: PluginLoadEntry[];
}

export interface UseImageBatchResult {
  // ─── 状态 ───
  ready: boolean;
  initError: string | null;
  items: BatchItem[];
  /** 是否有 item 正在处理 */
  busy: boolean;
  /** 已完成(done)的 item 数 */
  doneCount: number;
  /** 全部输入文件字节数 */
  totalInputBytes: number;
  /** 全部已完成输出字节数 */
  totalOutputBytes: number;

  // ─── 操作 ───
  addFiles: (files: File[]) => void;
  removeItem: (key: string) => void;
  reset: () => void;
}

/** items 的 reducer:集中管理增 / 删 / 状态迁移,避免多处 setItems 闭包竞态 */
type ItemsAction =
  | { type: 'add'; items: BatchItem[] }
  | { type: 'remove'; key: string }
  | { type: 'reset' }
  | { type: 'patch'; key: string; patch: Partial<BatchItem> }
  | { type: 'requeueNonProcessing' };

function itemsReducer(state: BatchItem[], action: ItemsAction): BatchItem[] {
  switch (action.type) {
    case 'add':
      return [...state, ...action.items];
    case 'remove':
      return state.filter((i) => i.key !== action.key);
    case 'reset':
      return [];
    case 'patch':
      return state.map((i) => (i.key === action.key ? { ...i, ...action.patch } : i));
    case 'requeueNonProcessing':
      return state.map((i) =>
        i.status === 'processing'
          ? i
          : { ...i, status: 'queued', outputBlob: null, outputInfo: null, error: null }
      );
  }
}

/**
 * 批量图片处理 hook(纯逻辑,无 UI)。
 */
export function useImageBatch(options: UseImageBatchOptions): UseImageBatchResult {
  const { capability, buildParams, paramsKey, onBatchComplete, plugins } = options;
  const { runtime, ready, error: initError } = useLokvisRuntime(undefined, plugins);

  const [items, dispatch] = useReducer(itemsReducer, []);
  const [busy, setBusy] = useState(false);

  // 最新值 ref:供异步 processItem / 回调读取,避免捕获旧闭包
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const buildParamsRef = useRef(buildParams);
  buildParamsRef.current = buildParams;
  const onBatchCompleteRef = useRef(onBatchComplete);
  onBatchCompleteRef.current = onBatchComplete;
  const capabilityRef = useRef(capability);
  capabilityRef.current = capability;

  // 顺序调度锁:任一时刻最多一个 item 处于 processing
  const processingRef = useRef(false);
  // addFiles 的 key 序号(保证同 name/size/lastModified 的文件 key 仍唯一)
  const seqRef = useRef(0);
  // 整批完成是否已通知(避免重复触发 onBatchComplete)
  const batchNotifiedRef = useRef(false);

  /** 处理单个 item:import → 读 inputInfo → buildParams → run → export → 读 outputInfo */
  const processItem = useCallback(
    async (key: string): Promise<void> => {
      if (processingRef.current) return;
      if (!runtime) return;
      processingRef.current = true;
      setBusy(true);
      dispatch({ type: 'patch', key, patch: { status: 'processing' } });
      try {
        const item = itemsRef.current.find((i) => i.key === key);
        if (!item) return; // 排队期间被移除
        const inputId = await runtime.importAsset({ kind: 'file', file: item.file });
        const inputInfo = await getImageInfo(item.file);
        dispatch({ type: 'patch', key, patch: { inputInfo } });
        const params = buildParamsRef.current(inputInfo);
        const workflow = buildSingleStepImageWorkflow(
          capabilityRef.current,
          params,
          'ImageBatch',
          'Batch process image'
        );
        const result = await runtime.run(workflow, [inputId]);
        if (result.status !== 'completed' || !result.outputs[0]) {
          throw new Error(result.error ?? '处理失败');
        }
        const outputBlob = await runtime.exportAsset(result.outputs[0]);
        const outputInfo = await getImageInfo(outputBlob);
        dispatch({
          type: 'patch',
          key,
          patch: { status: 'done', outputBlob, outputInfo, error: null },
        });
      } catch (err) {
        // 单 item 失败只落在 item.error,不中断后续(顺序调度锁在 finally 释放)
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: 'patch', key, patch: { status: 'error', error: message } });
      } finally {
        processingRef.current = false;
        setBusy(false);
      }
    },
    [runtime]
  );

  // 顺序调度:有 queued 且空闲时取下一个执行。
  // items 每次状态迁移都会触发本 effect,从而在处理完一个后自动接续下一个。
  useEffect(() => {
    if (!ready || !runtime) return;
    if (processingRef.current) return;
    const next = items.find((i) => i.status === 'queued');
    if (!next) return;
    void processItem(next.key);
  }, [items, ready, runtime, processItem]);

  // paramsKey 变化 → 非 processing 的 item 全部重置为 queued 重跑
  const prevParamsKeyRef = useRef(paramsKey);
  useEffect(() => {
    if (paramsKey === prevParamsKeyRef.current) return;
    prevParamsKeyRef.current = paramsKey;
    batchNotifiedRef.current = false;
    dispatch({ type: 'requeueNonProcessing' });
  }, [paramsKey]);

  // 整批完成回调:所有 item 离开 queued/processing 时触发一次
  useEffect(() => {
    if (items.length === 0) return;
    const allSettled = items.every((i) => i.status === 'done' || i.status === 'error');
    if (!allSettled) {
      // 有新工作进入(新增 / 重跑)时重置通知标记
      batchNotifiedRef.current = false;
      return;
    }
    if (batchNotifiedRef.current) return;
    batchNotifiedRef.current = true;
    onBatchCompleteRef.current?.({
      total: items.length,
      done: items.filter((i) => i.status === 'done').length,
      failed: items.filter((i) => i.status === 'error').length,
      inputBytes: items.reduce((sum, i) => sum + i.file.size, 0),
      outputBytes: items.reduce((sum, i) => sum + (i.outputBlob?.size ?? 0), 0),
    });
  }, [items]);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const newItems: BatchItem[] = files.map((file) => {
      const seq = seqRef.current++;
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${seq}`,
        file,
        inputUrl: URL.createObjectURL(file),
        inputInfo: null,
        status: 'queued',
        outputBlob: null,
        outputInfo: null,
        error: null,
      };
    });
    dispatch({ type: 'add', items: newItems });
  }, []);

  const removeItem = useCallback((key: string) => {
    const target = itemsRef.current.find((i) => i.key === key);
    if (target) URL.revokeObjectURL(target.inputUrl);
    dispatch({ type: 'remove', key });
  }, []);

  const reset = useCallback(() => {
    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.inputUrl);
    }
    dispatch({ type: 'reset' });
  }, []);

  // unmount 时统一 revoke 所有未释放的 inputUrl
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.inputUrl);
      }
    };
  }, []);

  const doneCount = useMemo(() => items.filter((i) => i.status === 'done').length, [items]);
  const totalInputBytes = useMemo(() => items.reduce((sum, i) => sum + i.file.size, 0), [items]);
  const totalOutputBytes = useMemo(
    () => items.reduce((sum, i) => sum + (i.outputBlob?.size ?? 0), 0),
    [items]
  );

  return {
    ready,
    initError,
    items,
    busy,
    doneCount,
    totalInputBytes,
    totalOutputBytes,
    addFiles,
    removeItem,
    reset,
  };
}

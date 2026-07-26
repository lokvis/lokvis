/**
 * useImageResize — 图片一键缩放的纯逻辑 hook(Layer 0),无 UI。
 *
 * 行为:
 *   1. 复用 useImageTool(runtime + input/output 生命周期)
 *   2. 接收 initialPreset / autoRun / onComplete / inputBlob 选项
 *   3. autoRun=true 时,上传后自动缩放(用 useRef 标记 lastRunInputId 防止重复触发)
 *   4. 切换 preset 时,若有输入则自动重跑
 *   5. 输出完成后触发 onComplete(可串联到下一个 hook,用于 pipeline)
 *
 * 4 个预设(见设计文档 §4.2.3):
 *   - ig-square:     IG 1:1   1080×1080
 *   - yt-landscape:  YouTube 16:9  1280×720
 *   - tk-portrait:   TikTok 9:16   1080×1920
 *   - half:          原图 50%(按 inputInfo 计算)
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useImageTool } from '../internal/useImageTool';
import { buildSingleStepImageWorkflow } from '../internal/workflow-builder';
import type { ImageInfo } from '../internal/download';
import {
  type UseEmbedActionOptions,
  type EmbedActionResult,
} from './useImageCompress';

// 重新导出共享类型,供 Layer 1/2 引用(避免跨文件直接依赖 useImageCompress)
export type { UseEmbedActionOptions, EmbedActionResult };

/** 缩放预设。 */
export type ResizePreset = 'ig-square' | 'yt-landscape' | 'tk-portrait' | 'half';

/**
 * 预设参数表:
 *   - 固定尺寸预设:width / height(单位 px)
 *   - 比例缩放预设:scale(0~1,基于原图尺寸)
 */
export interface ResizePresetConfig {
  /** 目标宽度(px)。与 scale 互斥 */
  width?: number;
  /** 目标高度(px)。与 scale 互斥 */
  height?: number;
  /** 缩放系数(0~1),基于原图尺寸。与 width/height 互斥 */
  scale?: number;
  /** 简介(供 UI 展示) */
  label: string;
}

/** 自定义目标尺寸。width/height 至少填一个;只填一个时按比例推算另一边 */
export interface ResizeCustomSize {
  width?: number;
  height?: number;
  /** 默认 true(与预设一致,fit-within 语义) */
  maintainAspectRatio?: boolean;
}

/** useImageResize 专属选项(在通用选项上扩展自定义尺寸) */
export interface UseImageResizeOptions extends UseEmbedActionOptions<ResizePreset> {
  /** 自定义目标尺寸。设置后进入 custom 模式:忽略 preset 参数表,直接使用该尺寸 */
  customSize?: ResizeCustomSize;
}

export const IMAGE_RESIZE_PRESETS: Record<ResizePreset, ResizePresetConfig> = {
  /** IG 1:1 1080×1080 */
  'ig-square': { width: 1080, height: 1080, label: 'Instagram 1:1' },
  /** YouTube 16:9 1280×720 */
  'yt-landscape': { width: 1280, height: 720, label: 'YouTube 16:9' },
  /** TikTok 9:16 1080×1920 */
  'tk-portrait': { width: 1080, height: 1920, label: 'TikTok 9:16' },
  /** 原图 50% */
  half: { scale: 0.5, label: '50% of original' },
};

/** useImageResize 返回值 */
export interface UseImageResizeResult {
  // ─── 状态 ───
  ready: boolean;
  initError: string | null;
  inputUrl: string | null;
  inputInfo: ImageInfo | null;
  outputUrl: string | null;
  outputInfo: ImageInfo | null;
  outputBlob: Blob | null;
  busy: boolean;
  error: string | null;
  /** 当前预设 */
  preset: ResizePreset;
  /** 输出尺寸(像素字符串,如 '1280×720';无输出时为 null) */
  outputDimension: string | null;
  /** 当前自定义尺寸(null 表示预设模式) */
  customSize: ResizeCustomSize | null;

  // ─── 操作 ───
  handleFiles: (files: File[]) => Promise<void>;
  setPreset: (preset: ResizePreset) => void;
  /** 设置/清除自定义尺寸(null 切回预设模式),并立即重跑 */
  setCustomSize: (size: ResizeCustomSize | null) => void;
  reset: () => void;
  clearError: () => void;
  /** 手动触发执行(autoRun=false 时用) */
  run: () => Promise<void>;
}

/** 有效尺寸:有限正数 */
function isValidDim(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 1;
}

/**
 * 根据 preset + 自定义尺寸 + 输入信息构造 resize 参数。
 * custom 优先(有效时直接使用);无效时静默回落 preset。
 * 'half' 预设需要 inputInfo 计算目标尺寸。
 */
function buildResizeParams(
  preset: ResizePreset,
  custom: ResizeCustomSize | null,
  inputInfo: ImageInfo | null
): { width?: number; height?: number; maintainAspectRatio?: boolean } {
  if (custom && (isValidDim(custom.width) || isValidDim(custom.height))) {
    return {
      width: isValidDim(custom.width) ? Math.round(custom.width) : undefined,
      height: isValidDim(custom.height) ? Math.round(custom.height) : undefined,
      maintainAspectRatio: custom.maintainAspectRatio ?? true,
    };
  }
  const config = IMAGE_RESIZE_PRESETS[preset];
  if (config.scale !== undefined) {
    if (!inputInfo) {
      // 没有 inputInfo 时,scale 预设无法计算,回退到不缩放
      return {};
    }
    return {
      width: Math.max(1, Math.round(inputInfo.width * config.scale)),
      height: Math.max(1, Math.round(inputInfo.height * config.scale)),
      maintainAspectRatio: true,
    };
  }
  return {
    width: config.width,
    height: config.height,
    maintainAspectRatio: true,
  };
}

/** resize 模式状态:preset 与 customSize 互斥,由 reducer 原子管理 */
interface ResizeModeState {
  preset: ResizePreset;
  customSize: ResizeCustomSize | null;
}

type ResizeModeAction =
  | { type: 'setPreset'; preset: ResizePreset }
  | { type: 'setCustomSize'; customSize: ResizeCustomSize | null };

/**
 * 模式 reducer(单 setter 纪律):
 *   - setPreset 原子地清空 customSize(切回预设模式)
 *   - setCustomSize 原子地覆写 customSize(null 切回预设模式,保留 preset)
 *
 * 两个字段在同一次提交中更新,避免 setPreset/setCustomSize 各自捕获对方旧闭包、
 * 连续调用时 workflow 参数与最终状态不一致的竞态。
 */
function resizeModeReducer(state: ResizeModeState, action: ResizeModeAction): ResizeModeState {
  switch (action.type) {
    case 'setPreset':
      return { preset: action.preset, customSize: null };
    case 'setCustomSize':
      return { preset: state.preset, customSize: action.customSize };
  }
}

/**
 * 图片一键缩放 hook(纯逻辑,无 UI)。
 */
export function useImageResize(
  options?: UseImageResizeOptions
): UseImageResizeResult {
  const {
    initialPreset = 'ig-square',
    autoRun = true,
    onComplete,
    plugins,
    customSize: initialCustomSize,
  } = options ?? {};
  const tool = useImageTool(plugins);

  // preset 与 customSize 由单一 reducer 原子管理,消除各自 setter 捕获对方旧闭包的竞态
  const [mode, dispatch] = useReducer(resizeModeReducer, {
    preset: initialPreset,
    customSize: initialCustomSize ?? null,
  });

  const lastNotifiedBlob = useRef<Blob | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  // 记录上一次的 inputId 与已执行的 (inputId|mode) 组合,用于去重与 autoRun 门控
  const prevInputIdRef = useRef<string | null>(null);
  const lastRunKeyRef = useRef<string | null>(null);

  /** 实际执行缩放(根据 preset + custom 构造 workflow) */
  const runResize = useCallback(
    async (nextPreset: ResizePreset, custom: ResizeCustomSize | null): Promise<void> => {
      const params = buildResizeParams(nextPreset, custom, tool.inputInfo);
      const wf = buildSingleStepImageWorkflow(
        'image.resize',
        params,
        'ImageResize',
        'Quick resize image with preset'
      );
      await tool.runWorkflow(wf);
    },
    [tool]
  );

  // output 完成后触发 onComplete
  useEffect(() => {
    if (
      tool.outputBlob &&
      tool.outputBlob !== lastNotifiedBlob.current &&
      tool.inputInfo &&
      tool.outputInfo &&
      tool.outputUrl
    ) {
      lastNotifiedBlob.current = tool.outputBlob;
      onCompleteRef.current?.({
        outputBlob: tool.outputBlob,
        outputUrl: tool.outputUrl,
        inputSize: tool.inputInfo.size,
        outputSize: tool.outputInfo.size,
        preset: mode.preset,
      });
    }
  }, [tool.outputBlob, tool.outputUrl, tool.inputInfo, tool.outputInfo, mode.preset]);

  // 统一触发:每个新的 (inputId, mode) 组合只执行一次 workflow。
  //   - 新输入到达由 autoRun 门控;mode 变化(setPreset/setCustomSize)总是重跑
  //   - busy 时丢弃(与既有行为一致)
  // 读取的是 reducer 提交后的原子状态:连续调用 setPreset/setCustomSize 被 React
  // 批处理为一次提交,仅触发一次 workflow,且参数与最终状态一致(消除竞态)。
  useEffect(() => {
    const inputId = tool.inputId;
    const inputChanged = inputId !== prevInputIdRef.current;
    prevInputIdRef.current = inputId;

    if (!inputId || !tool.ready) {
      lastRunKeyRef.current = null;
      return;
    }

    const key = `${inputId}|${mode.preset}|${JSON.stringify(mode.customSize)}`;
    if (key === lastRunKeyRef.current) return;
    lastRunKeyRef.current = key;

    if (inputChanged && !autoRun) return;
    if (tool.busy) return;
    void runResize(mode.preset, mode.customSize);
  }, [tool.inputId, tool.ready, tool.busy, autoRun, mode.preset, mode.customSize, runResize]);

  /** 切换预设(原子清空 customSize,切回预设模式) */
  const setPreset = useCallback(
    (next: ResizePreset) => dispatch({ type: 'setPreset', preset: next }),
    []
  );

  /** 设置/清除自定义尺寸(null 切回预设模式) */
  const setCustomSize = useCallback(
    (size: ResizeCustomSize | null) => dispatch({ type: 'setCustomSize', customSize: size }),
    []
  );

  const handleFiles = useCallback(
    async (files: File[]): Promise<void> => {
      await tool.handleFiles(files);
    },
    [tool]
  );

  const outputDimension = tool.outputInfo
    ? `${tool.outputInfo.width}×${tool.outputInfo.height}`
    : null;

  return {
    ready: tool.ready,
    initError: tool.initError,
    inputUrl: tool.inputUrl,
    inputInfo: tool.inputInfo,
    outputUrl: tool.outputUrl,
    outputInfo: tool.outputInfo,
    outputBlob: tool.outputBlob,
    busy: tool.busy,
    error: tool.error,
    preset: mode.preset,
    outputDimension,
    customSize: mode.customSize,
    handleFiles,
    setPreset,
    setCustomSize,
    reset: tool.reset,
    clearError: tool.clearError,
    run: () => runResize(mode.preset, mode.customSize),
  };
}

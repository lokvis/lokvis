/**
 * ToolRunner - 单工具页组合组件
 *
 * 为单工具操作场景(压缩、裁剪、格式转换等)提供一站式 UI:
 * 上传 → 调参 → 处理 → 对比 → 下载。
 *
 * 不依赖 Workspace Store(zustand),通过 engine prop 注入处理函数,
 * 可在任何 React 应用中独立使用。
 *
 * 五层架构:UI 层不直接依赖 Engine 层,engine 函数由消费方传入。
 * 消费方需自行实现按 capability.name 路由到对应 Blob↔Blob 操作的 wrapper
 * (engine-image 已不再提供 runTool 统一入口,各 operation 需直接组合调用)。
 *
 * @example
 * ```tsx
 * import { ToolRunner } from '@lokvis/ui-react';
 * import { IMAGE_COMPRESS, compress } from '@lokvis/engine-image';
 *
 * <ToolRunner
 *   capability={IMAGE_COMPRESS}
 *   engine={(name, input, params, opts) => compress(input, params, opts?.signal)}
 *   onOpenInWorkspace={(state) => { ... }}
 * />
 * ```
 */

import * as React from 'react';
import type { Capability } from '@lokvis/schema';
import { Button, Card } from '@lokvis/ui-core';
import { ParamForm } from './ParamForm.js';
import type { Language } from '../i18n/config.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

type EngineFn = (
 toolName: string,
 input: Blob,
 params: Record<string, unknown>,
 options?: { signal?: AbortSignal; onProgress?: (p: number) => void },
) => Promise<Blob>;

export interface ToolRunnerProps {
 /** 工具能力定义(决定参数表单和输入类型) */
 capability: Capability;
 /** 处理函数(按 capability.name 路由到对应 Blob↔Blob 操作的 wrapper) */
  engine: EngineFn;
 /** 在 Workspace 中打开的回调(携带当前状态) */
 onOpenInWorkspace?: (state: {
  inputBlob: Blob;
  outputBlob: Blob | null;
  params: Record<string, unknown>;
 }) => void;
 /**
  * 显式 UI 语言(本组件可独立于 Workspace 挂载,无 Provider 时用此
  * prop 指定语言;不传则回落到 html lang / URL 自动检测)。
  */
 locale?: Language;
 className?: string;
}

/**
 * ToolRunner - 单工具操作组件。
 *
 * 内部组合:上传区 + 参数表单 + 预览/对比 + 进度 + 下载。
 * 所有状态自管理,不依赖外部 store。
 */
export function ToolRunner({
 capability,
 engine,
 onOpenInWorkspace,
 locale,
 className = '',
}: ToolRunnerProps) {
 const lang = useWorkspaceLang(locale);
 const t = useWorkspaceTranslations(lang);
 const [inputBlob, setInputBlob] = React.useState<Blob | null>(null);
 const [inputUrl, setInputUrl] = React.useState<string | null>(null);
 const [outputBlob, setOutputBlob] = React.useState<Blob | null>(null);
 const [outputUrl, setOutputUrl] = React.useState<string | null>(null);
 const [params, setParams] = React.useState<Record<string, unknown>>(() => {
  const defaults: Record<string, unknown> = {};
  for (const p of capability.params) {
   if (p.default !== undefined) defaults[p.name] = p.default;
  }
  return defaults;
 });
 const [progress, setProgress] = React.useState(0);
 const [processing, setProcessing] = React.useState(false);
 const [error, setError] = React.useState<string | null>(null);
 const [dragging, setDragging] = React.useState(false);
 const abortRef = React.useRef<AbortController | null>(null);

 // 清理 ObjectURL
 React.useEffect(() => {
  return () => {
   if (inputUrl) URL.revokeObjectURL(inputUrl);
   if (outputUrl) URL.revokeObjectURL(outputUrl);
  };
 }, [inputUrl, outputUrl]);

 // W21.6: unmount 时 abort 进行中的处理,防止后台泄漏
 // (engine 函数持有 Worker/Canvas 资源,卸载后继续运行是浪费 + 潜在内存泄漏)
 React.useEffect(() => {
  return () => {
   if (abortRef.current) {
    abortRef.current.abort();
    abortRef.current = null;
   }
  };
 }, []);

 const accept = capability.inputTypes.join(',');

 function handleFiles(files: FileList | File[] | null) {
  if (!files || files.length === 0) return;
  const file = files[0];
  if (!file) return;

  setInputBlob(file);
  if (inputUrl) URL.revokeObjectURL(inputUrl);
  setInputUrl(URL.createObjectURL(file));

  // 重置输出
  setOutputBlob(null);
  if (outputUrl) {
   URL.revokeObjectURL(outputUrl);
   setOutputUrl(null);
  }
 }

 async function handleProcess() {
  if (!inputBlob) return;
  setProcessing(true);
  setProgress(0);
  setError(null);

  abortRef.current = new AbortController();
  try {
   const result = await engine(capability.name, inputBlob, params, {
    signal: abortRef.current.signal,
    onProgress: setProgress,
   });
   setOutputBlob(result);
   if (outputUrl) URL.revokeObjectURL(outputUrl);
   setOutputUrl(URL.createObjectURL(result));
  } catch (err) {
   if (err instanceof Error && err.name === 'AbortError') return;
   setError(err instanceof Error ? err.message : String(err));
  } finally {
   setProcessing(false);
   abortRef.current = null;
  }
 }

 function handleCancel() {
  abortRef.current?.abort();
 }

 const downloadName = outputBlob
  ? `output.${outputBlob.type.split('/')[1] ?? 'bin'}`
  : 'output';

 return (
  <div className={`flex flex-col gap-6 ${className}`}>
   {/* Upload zone */}
   {!inputBlob && (
    <label
     className={`block cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
      dragging
       ? 'border-[var(--lokvis-primary)] bg-[var(--lokvis-primary)]/10'
       : 'border-[var(--lokvis-border)] hover:border-[var(--lokvis-primary)]/50 hover:bg-[var(--lokvis-surface-muted)]'
     }`}
     onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
     onDragLeave={() => setDragging(false)}
     onDrop={(e) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
     }}
    >
     <input
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => handleFiles(e.target.files)}
     />
     <div className="flex flex-col items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--lokvis-surface-muted)]">
       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--lokvis-fg-subtle)]">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
       </svg>
      </div>
      <div>
       <p className="text-sm font-medium text-[var(--lokvis-fg)]">
        {t('toolRunner.dropHint')}
       </p>
       <p className="mt-1 text-xs text-[var(--lokvis-fg-subtle)]">
        {t('toolRunner.accepted', { accept: accept || t('toolRunner.anyFile') })}
       </p>
      </div>
     </div>
    </label>
   )}

   {/* Processing area */}
   {inputBlob && (
    <div className="grid gap-6 md:grid-cols-2">
     {/* Left: Parameters */}
     <div className="space-y-4">
      <Card>
       <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--lokvis-fg)]">
         {t('toolRunner.parameters')}
        </h3>
        <span className="rounded bg-[var(--lokvis-surface-muted)] px-2 py-0.5 font-mono text-xs text-[var(--lokvis-primary)]">
         {capability.name}
        </span>
       </div>
       <ParamForm
        capability={capability}
        values={params}
        onChange={setParams}
       />
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
       <Button
        variant="primary"
        size="md"
        onClick={handleProcess}
        loading={processing}
        disabled={!inputBlob}
       >
        {processing ? t('toolRunner.processing') : t('toolRunner.process')}
       </Button>
       <Button
        variant="secondary"
        size="md"
        onClick={() => {
         setInputBlob(null);
         if (inputUrl) URL.revokeObjectURL(inputUrl);
         setInputUrl(null);
         setOutputBlob(null);
         if (outputUrl) {
          URL.revokeObjectURL(outputUrl);
          setOutputUrl(null);
         }
        }}
       >
        {t('toolRunner.changeFile')}
       </Button>
       {onOpenInWorkspace && (
        <Button
         variant="ghost"
         size="md"
         onClick={() => onOpenInWorkspace({ inputBlob, outputBlob, params })}
        >
         {t('toolRunner.openInWorkspace')}
        </Button>
       )}
      </div>

      {/* Progress */}
      {processing && (
       <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--lokvis-fg-muted)]">
         <span>{t('toolRunner.processing')}</span>
         <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--lokvis-border)]">
         <div
          className="h-full rounded-full bg-[var(--lokvis-primary)] transition-all duration-200"
          style={{ width: `${progress}%` }}
         />
        </div>
        <button
         type="button"
         onClick={handleCancel}
         className="text-xs text-[var(--lokvis-danger)] hover:underline"
        >
         {t('toolRunner.cancel')}
        </button>
       </div>
      )}

      {/* Error */}
      {error && (
       <div className="rounded-lg border border-[var(--lokvis-danger)]/30 bg-[var(--lokvis-danger)]/10 px-4 py-3 text-sm text-[var(--lokvis-danger)]">
        {error}
       </div>
      )}

      {/* Download */}
      {outputBlob && outputUrl && (
       <Card>
        <div className="flex items-center justify-between">
         <div>
          <p className="text-sm font-medium text-[var(--lokvis-fg)]">{t('toolRunner.ready')}</p>
          <p className="mt-1 text-xs text-[var(--lokvis-fg-muted)]">
           {(outputBlob.size / 1024).toFixed(1)} KB · {outputBlob.type.split('/')[1] ?? 'file'}
          </p>
         </div>
         <a
          href={outputUrl}
          download={downloadName}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--lokvis-primary)] px-4 py-2 text-sm font-medium text-[var(--lokvis-primary-fg)] transition-colors hover:bg-[var(--lokvis-primary-hover)]"
         >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
           <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
           <polyline points="7 10 12 15 17 10" />
           <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('toolRunner.download')}
         </a>
        </div>
       </Card>
      )}
     </div>

     {/* Right: Preview */}
     <div className="space-y-4">
      {/* Input preview */}
      {inputUrl && (
       <Card>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
         {t('toolRunner.input')}
        </h4>
        <img
         src={inputUrl}
         alt={t('toolRunner.inputAlt')}
         className="max-h-80 w-full rounded-lg object-contain"
        />
        <p className="mt-2 text-xs text-[var(--lokvis-fg-muted)]">
         {(inputBlob.size / 1024).toFixed(1)} KB · {inputBlob.type.split('/')[1] ?? 'file'}
        </p>
       </Card>
      )}

      {/* Output preview */}
      {outputUrl && (
       <Card>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--lokvis-fg-subtle)]">
         {t('toolRunner.output')}
        </h4>
        <img
         src={outputUrl}
         alt={t('toolRunner.outputAlt')}
         className="max-h-80 w-full rounded-lg object-contain"
        />
        <p className="mt-2 text-xs text-[var(--lokvis-fg-muted)]">
         {(outputBlob!.size / 1024).toFixed(1)} KB · {outputBlob!.type.split('/')[1] ?? 'file'}
        </p>
       </Card>
      )}
     </div>
    </div>
   )}
  </div>
 );
}

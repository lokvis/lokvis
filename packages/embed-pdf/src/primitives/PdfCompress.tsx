/**
 * PdfCompress — Layer 1 无样式复合组件(行为 + ARIA,零视觉)。
 *
 * 子组件:Root / Upload / PresetSwitcher / Preview / RatioBadge / DownloadButton / ErrorDisplay / ResetButton
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  usePdfCompress,
  type PdfCompressPreset,
  type UsePdfCompressResult,
  type UsePdfActionOptions,
} from '../hooks/usePdfCompress';
import { fileMatchesPdf, DefaultPresetButton } from './shared';

const PdfCompressContext = createContext<UsePdfCompressResult | null>(null);

function usePdfCompressContext(): UsePdfCompressResult {
  const ctx = useContext(PdfCompressContext);
  if (!ctx) throw new Error('PdfCompress sub-components must be wrapped in <PdfCompress.Root>');
  return ctx;
}

function Root(props: UsePdfActionOptions<PdfCompressPreset> & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = usePdfCompress(options);
  return createElement(PdfCompressContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode | ((state: { isDragging: boolean }) => ReactNode); accept?: string }) {
  const ctx = usePdfCompressContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const isDragging = dragCount.current > 0;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCount.current = 0;
      const files = Array.from(e.dataTransfer.files).filter(fileMatchesPdf);
      if (files.length > 0) void ctx.handleFiles(files);
    },
    [ctx]
  );

  return createElement(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Upload PDF file',
      onClick: () => inputRef.current?.click(),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      },
      onDragEnter: (e: React.DragEvent) => { e.preventDefault(); dragCount.current++; },
      onDragLeave: (e: React.DragEvent) => { e.preventDefault(); dragCount.current--; },
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: handleDrop,
    },
    typeof props.children === 'function' ? props.children({ isDragging }) : props.children,
    createElement('input', {
      ref: inputRef,
      type: 'file',
      accept: props.accept ?? '.pdf,application/pdf',
      style: { display: 'none' },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).filter(fileMatchesPdf);
        if (files.length > 0) void ctx.handleFiles(files);
        e.target.value = '';
      },
    })
  );
}

function PresetSwitcher(props: { renderButton?: (preset: PdfCompressPreset, active: boolean) => ReactNode }) {
  const ctx = usePdfCompressContext();
  const presets: PdfCompressPreset[] = ['fast', 'compress'];
  return createElement(
    'div',
    { role: 'radiogroup', 'aria-label': 'Compression preset' },
    presets.map((p) =>
      props.renderButton
        ? createElement('span', { key: p, onClick: () => ctx.setPreset(p) }, props.renderButton(p, ctx.preset === p))
        : createElement(DefaultPresetButton, { key: p, active: ctx.preset === p, onClick: () => ctx.setPreset(p), label: p }, p)
    )
  );
}

function Preview(props: { type: 'input' | 'output' }) {
  const ctx = usePdfCompressContext();
  const urls = props.type === 'input' ? ctx.inputUrls : ctx.outputUrls;
  if (urls.length === 0) return null;
  return createElement(
    'div',
    { 'aria-label': `${props.type} preview` },
    urls.map((url, i) => createElement('iframe', { key: i, src: url, title: `${props.type}-${i}`, style: { width: '100%', height: '300px', border: 'none' } }))
  );
}

function RatioBadge(props: { format?: (ratio: number) => string }) {
  const ctx = usePdfCompressContext();
  if (ctx.ratio === null) return null;
  const text = props.format ? props.format(ctx.ratio) : `${ctx.ratio > 0 ? '-' : '+'}${Math.abs(ctx.ratio).toFixed(1)}%`;
  return createElement('span', { role: 'status', 'aria-label': 'Compression ratio' }, text);
}

function DownloadButton(props: { children?: ReactNode; filename?: string }) {
  const ctx = usePdfCompressContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download compressed PDF',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'compressed.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      },
    },
    props.children ?? 'Download'
  );
}

function ErrorDisplay(props: { format?: (error: string) => string }) {
  const ctx = usePdfCompressContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = usePdfCompressContext();
  const disabled = ctx.inputUrls.length === 0;
  return createElement(
    'button',
    { type: 'button', disabled, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const PdfCompress = { Root, Upload, PresetSwitcher, Preview, RatioBadge, DownloadButton, ErrorDisplay, ResetButton };

/**
 * PdfSplit — Layer 1 无样式复合组件(多输出)。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  usePdfSplit,
  type PdfSplitPreset,
  type UsePdfSplitOptions,
  type UsePdfSplitResult,
} from '../hooks/usePdfSplit';
import { fileMatchesPdf, DefaultPresetButton } from './shared';

const PdfSplitContext = createContext<UsePdfSplitResult | null>(null);

function usePdfSplitContext(): UsePdfSplitResult {
  const ctx = useContext(PdfSplitContext);
  if (!ctx) throw new Error('PdfSplit sub-components must be wrapped in <PdfSplit.Root>');
  return ctx;
}

function Root(props: UsePdfSplitOptions & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = usePdfSplit(options);
  return createElement(PdfSplitContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = usePdfSplitContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return createElement(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Upload PDF file to split',
      onClick: () => inputRef.current?.click(),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      },
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(fileMatchesPdf);
        if (files.length > 0) void ctx.handleFiles(files);
      },
    },
    props.children,
    createElement('input', {
      ref: inputRef,
      type: 'file',
      accept: '.pdf,application/pdf',
      style: { display: 'none' },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).filter(fileMatchesPdf);
        if (files.length > 0) void ctx.handleFiles(files);
        e.target.value = '';
      },
    })
  );
}

function PresetSwitcher(props: { renderButton?: (preset: PdfSplitPreset, active: boolean) => ReactNode }) {
  const ctx = usePdfSplitContext();
  const presets: PdfSplitPreset[] = ['every-page', '2-pages', '5-pages'];
  return createElement(
    'div',
    { role: 'radiogroup', 'aria-label': 'Split preset' },
    presets.map((p) =>
      props.renderButton
        ? createElement('span', { key: p, onClick: () => ctx.setPreset(p) }, props.renderButton(p, ctx.preset === p))
        : createElement(DefaultPresetButton, { key: p, active: ctx.preset === p, onClick: () => ctx.setPreset(p), label: p }, p)
    )
  );
}

function OutputCount(props: { format?: (count: number) => string }) {
  const ctx = usePdfSplitContext();
  if (ctx.outputCount === 0) return null;
  const text = props.format ? props.format(ctx.outputCount) : `${ctx.outputCount} files`;
  return createElement('span', { role: 'status' }, text);
}

function DownloadAllButton(props: { children?: ReactNode }) {
  const ctx = usePdfSplitContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download all split files',
      onClick: () => {
        ctx.outputBlobs.forEach((blob, i) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `split-${i + 1}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      },
    },
    props.children ?? 'Download All'
  );
}

function ErrorDisplay(props: { format?: (error: string) => string }) {
  const ctx = usePdfSplitContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = usePdfSplitContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const PdfSplit = { Root, Upload, PresetSwitcher, OutputCount, DownloadAllButton, ErrorDisplay, ResetButton };

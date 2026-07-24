/**
 * PdfMerge — Layer 1 无样式复合组件(多文件输入)。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import { usePdfMerge, type UsePdfMergeOptions, type UsePdfMergeResult } from '../hooks/usePdfMerge';
import { fileMatchesPdf } from './shared';

const PdfMergeContext = createContext<UsePdfMergeResult | null>(null);

function usePdfMergeContext(): UsePdfMergeResult {
  const ctx = useContext(PdfMergeContext);
  if (!ctx) throw new Error('PdfMerge sub-components must be wrapped in <PdfMerge.Root>');
  return ctx;
}

function Root(props: UsePdfMergeOptions & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = usePdfMerge(options);
  return createElement(PdfMergeContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = usePdfMergeContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return createElement(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Upload PDF files to merge',
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
      multiple: true,
      style: { display: 'none' },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).filter(fileMatchesPdf);
        if (files.length > 0) void ctx.handleFiles(files);
        e.target.value = '';
      },
    })
  );
}

function FileCount(props: { format?: (count: number) => string }) {
  const ctx = usePdfMergeContext();
  if (ctx.fileCount === 0) return null;
  const text = props.format ? props.format(ctx.fileCount) : `${ctx.fileCount} files selected`;
  return createElement('span', { role: 'status' }, text);
}

function DownloadButton(props: { children?: ReactNode; filename?: string }) {
  const ctx = usePdfMergeContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download merged PDF',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'merged.pdf';
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
  const ctx = usePdfMergeContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = usePdfMergeContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.fileCount === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const PdfMerge = { Root, Upload, FileCount, DownloadButton, ErrorDisplay, ResetButton };

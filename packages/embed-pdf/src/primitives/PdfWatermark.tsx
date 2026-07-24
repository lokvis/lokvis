/**
 * PdfWatermark — Layer 1 无样式复合组件。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  usePdfWatermark,
  type PdfWatermarkPreset,
  type UsePdfWatermarkOptions,
  type UsePdfWatermarkResult,
} from '../hooks/usePdfWatermark';
import { fileMatchesPdf, DefaultPresetButton } from './shared';

const PdfWatermarkContext = createContext<UsePdfWatermarkResult | null>(null);

function usePdfWatermarkContext(): UsePdfWatermarkResult {
  const ctx = useContext(PdfWatermarkContext);
  if (!ctx) throw new Error('PdfWatermark sub-components must be wrapped in <PdfWatermark.Root>');
  return ctx;
}

function Root(props: UsePdfWatermarkOptions & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = usePdfWatermark(options);
  return createElement(PdfWatermarkContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = usePdfWatermarkContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return createElement(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Upload PDF file to watermark',
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

function PresetSwitcher(props: { renderButton?: (preset: PdfWatermarkPreset, active: boolean) => ReactNode }) {
  const ctx = usePdfWatermarkContext();
  const presets: PdfWatermarkPreset[] = ['confidential', 'draft', 'custom'];
  return createElement(
    'div',
    { role: 'radiogroup', 'aria-label': 'Watermark preset' },
    presets.map((p) =>
      props.renderButton
        ? createElement('span', { key: p, onClick: () => ctx.setPreset(p) }, props.renderButton(p, ctx.preset === p))
        : createElement(DefaultPresetButton, { key: p, active: ctx.preset === p, onClick: () => ctx.setPreset(p), label: p }, p)
    )
  );
}

function TextInput(props: { placeholder?: string }) {
  const ctx = usePdfWatermarkContext();
  return createElement('input', {
    type: 'text',
    value: ctx.text,
    placeholder: props.placeholder ?? 'Watermark text',
    'aria-label': 'Watermark text',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => ctx.setText(e.target.value),
  });
}

function DownloadButton(props: { children?: ReactNode; filename?: string }) {
  const ctx = usePdfWatermarkContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download watermarked PDF',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'watermarked.pdf';
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
  const ctx = usePdfWatermarkContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = usePdfWatermarkContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const PdfWatermark = { Root, Upload, PresetSwitcher, TextInput, DownloadButton, ErrorDisplay, ResetButton };

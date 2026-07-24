/**
 * PdfRotate — Layer 1 无样式复合组件。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  usePdfRotate,
  type PdfRotatePreset,
  type UsePdfRotateOptions,
  type UsePdfRotateResult,
} from '../hooks/usePdfRotate';
import { fileMatchesPdf, DefaultPresetButton } from './shared';

const PdfRotateContext = createContext<UsePdfRotateResult | null>(null);

function usePdfRotateContext(): UsePdfRotateResult {
  const ctx = useContext(PdfRotateContext);
  if (!ctx) throw new Error('PdfRotate sub-components must be wrapped in <PdfRotate.Root>');
  return ctx;
}

function Root(props: UsePdfRotateOptions & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = usePdfRotate(options);
  return createElement(PdfRotateContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = usePdfRotateContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return createElement(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Upload PDF file to rotate',
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

function PresetSwitcher(props: { renderButton?: (preset: PdfRotatePreset, active: boolean) => ReactNode }) {
  const ctx = usePdfRotateContext();
  const presets: PdfRotatePreset[] = ['90', '180', '270'];
  return createElement(
    'div',
    { role: 'radiogroup', 'aria-label': 'Rotation angle' },
    presets.map((p) =>
      props.renderButton
        ? createElement('span', { key: p, onClick: () => ctx.setPreset(p) }, props.renderButton(p, ctx.preset === p))
        : createElement(DefaultPresetButton, { key: p, active: ctx.preset === p, onClick: () => ctx.setPreset(p), label: `${p}°` }, `${p}°`)
    )
  );
}

function DownloadButton(props: { children?: ReactNode; filename?: string }) {
  const ctx = usePdfRotateContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download rotated PDF',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'rotated.pdf';
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
  const ctx = usePdfRotateContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = usePdfRotateContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const PdfRotate = { Root, Upload, PresetSwitcher, DownloadButton, ErrorDisplay, ResetButton };

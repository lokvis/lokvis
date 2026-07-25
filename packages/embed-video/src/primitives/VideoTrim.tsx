/**
 * VideoTrim — Layer 1 无样式复合组件(行为 + ARIA,零视觉)。
 *
 * 无预设切换器;提供 TimeInputs 子组件用于设定裁剪起止时间。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  useVideoTrim,
  type UseVideoTrimOptions,
  type UseVideoTrimResult,
} from '../hooks/useVideoTrim';
import { fileMatchesVideo } from './shared';

const VideoTrimContext = createContext<UseVideoTrimResult | null>(null);

export function useVideoTrimContext(): UseVideoTrimResult {
  const ctx = useContext(VideoTrimContext);
  if (!ctx) throw new Error('VideoTrim sub-components must be wrapped in <VideoTrim.Root>');
  return ctx;
}

function Root(props: UseVideoTrimOptions & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = useVideoTrim(options);
  return createElement(VideoTrimContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = useVideoTrimContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return createElement(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Upload video file',
      onClick: () => inputRef.current?.click(),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      },
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(fileMatchesVideo);
        if (files.length > 0) void ctx.handleFiles(files);
      },
    },
    props.children,
    createElement('input', {
      ref: inputRef,
      type: 'file',
      accept: 'video/*',
      style: { display: 'none' },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).filter(fileMatchesVideo);
        if (files.length > 0) void ctx.handleFiles(files);
        e.target.value = '';
      },
    })
  );
}

/** 时间输入子组件:两个 number input 设定裁剪起止时间(秒) */
function TimeInputs(props: { startLabel?: string; endLabel?: string }) {
  const ctx = useVideoTrimContext();
  return createElement(
    'div',
    { role: 'group', 'aria-label': 'Trim time range' },
    createElement('label', { htmlFor: 'trim-start' }, props.startLabel ?? 'Start (s)'),
    createElement('input', {
      id: 'trim-start',
      type: 'number',
      min: 0,
      step: 0.1,
      value: ctx.startTime,
      'aria-label': props.startLabel ?? 'Start time (seconds)',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => ctx.setStartTime(Number(e.target.value)),
    }),
    createElement('label', { htmlFor: 'trim-end' }, props.endLabel ?? 'End (s)'),
    createElement('input', {
      id: 'trim-end',
      type: 'number',
      min: 0,
      step: 0.1,
      value: ctx.endTime,
      'aria-label': props.endLabel ?? 'End time (seconds)',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => ctx.setEndTime(Number(e.target.value)),
    })
  );
}

function Preview(props: { type: 'input' | 'output' }) {
  const ctx = useVideoTrimContext();
  const urls = props.type === 'input' ? ctx.inputUrls : ctx.outputUrls;
  if (urls.length === 0) return null;
  return createElement(
    'div',
    { 'aria-label': `${props.type} preview` },
    urls.map((url, i) =>
      createElement('video', { key: i, src: url, controls: true, style: { maxWidth: '100%' } })
    )
  );
}

function DownloadButton(props: { children?: ReactNode; filename?: string }) {
  const ctx = useVideoTrimContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download trimmed video',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'trimmed.mp4';
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
  const ctx = useVideoTrimContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = useVideoTrimContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const VideoTrim = { Root, Upload, TimeInputs, Preview, DownloadButton, ErrorDisplay, ResetButton };

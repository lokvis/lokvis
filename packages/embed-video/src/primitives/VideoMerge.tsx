/**
 * VideoMerge — Layer 1 无样式复合组件(行为 + ARIA,零视觉)。
 *
 * 多文件输入(N→1),Upload 接受 multiple,无预设切换器。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  useVideoMerge,
  type UseVideoMergeOptions,
  type UseVideoMergeResult,
} from '../hooks/useVideoMerge';
import { fileMatchesVideo } from './shared';

const VideoMergeContext = createContext<UseVideoMergeResult | null>(null);

export function useVideoMergeContext(): UseVideoMergeResult {
  const ctx = useContext(VideoMergeContext);
  if (!ctx) throw new Error('VideoMerge sub-components must be wrapped in <VideoMerge.Root>');
  return ctx;
}

function Root(props: UseVideoMergeOptions & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = useVideoMerge(options);
  return createElement(VideoMergeContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = useVideoMergeContext();
  const inputRef = useRef<HTMLInputElement>(null);

  return createElement(
    'div',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Upload video files',
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
      multiple: true,
      style: { display: 'none' },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).filter(fileMatchesVideo);
        if (files.length > 0) void ctx.handleFiles(files);
        e.target.value = '';
      },
    })
  );
}

function Preview(props: { type: 'input' | 'output' }) {
  const ctx = useVideoMergeContext();
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
  const ctx = useVideoMergeContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download merged video',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'merged.mp4';
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
  const ctx = useVideoMergeContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = useVideoMergeContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const VideoMerge = { Root, Upload, Preview, DownloadButton, ErrorDisplay, ResetButton };

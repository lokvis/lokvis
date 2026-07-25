/**
 * VideoTranscode — Layer 1 无样式复合组件(行为 + ARIA,零视觉)。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  useVideoTranscode,
  type VideoTranscodePreset,
  type UseVideoTranscodeResult,
} from '../hooks/useVideoTranscode';
import type { UseVideoActionOptions } from '../hooks/useVideoCompress';
import { fileMatchesVideo, DefaultPresetButton } from './shared';

const VideoTranscodeContext = createContext<UseVideoTranscodeResult | null>(null);

export function useVideoTranscodeContext(): UseVideoTranscodeResult {
  const ctx = useContext(VideoTranscodeContext);
  if (!ctx) throw new Error('VideoTranscode sub-components must be wrapped in <VideoTranscode.Root>');
  return ctx;
}

function Root(props: UseVideoActionOptions<VideoTranscodePreset> & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = useVideoTranscode(options);
  return createElement(VideoTranscodeContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = useVideoTranscodeContext();
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

function PresetSwitcher(props: { renderButton?: (preset: VideoTranscodePreset, active: boolean) => ReactNode }) {
  const ctx = useVideoTranscodeContext();
  const presets: VideoTranscodePreset[] = ['mp4', 'webm', 'gif'];
  return createElement(
    'div',
    { role: 'radiogroup', 'aria-label': 'Transcode format' },
    presets.map((p) =>
      props.renderButton
        ? createElement('span', { key: p, onClick: () => ctx.setPreset(p) }, props.renderButton(p, ctx.preset === p))
        : createElement(DefaultPresetButton, { key: p, active: ctx.preset === p, onClick: () => ctx.setPreset(p), label: p }, p)
    )
  );
}

function Preview(props: { type: 'input' | 'output' }) {
  const ctx = useVideoTranscodeContext();
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
  const ctx = useVideoTranscodeContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download transcoded video',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? `transcoded.${ctx.preset}`;
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
  const ctx = useVideoTranscodeContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = useVideoTranscodeContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const VideoTranscode = { Root, Upload, PresetSwitcher, Preview, DownloadButton, ErrorDisplay, ResetButton };

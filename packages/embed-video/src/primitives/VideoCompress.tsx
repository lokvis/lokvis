/**
 * VideoCompress — Layer 1 无样式复合组件(行为 + ARIA,零视觉)。
 *
 * 作为 embed-video primitives 的典型示例,其他视频工具原语结构一致。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  useVideoCompress,
  type VideoCompressPreset,
  type UseVideoActionOptions,
  type UseVideoCompressResult,
} from '../hooks/useVideoCompress';
import { fileMatchesVideo, DefaultPresetButton } from './shared';

const VideoCompressContext = createContext<UseVideoCompressResult | null>(null);

function useVideoCompressContext(): UseVideoCompressResult {
  const ctx = useContext(VideoCompressContext);
  if (!ctx) throw new Error('VideoCompress sub-components must be wrapped in <VideoCompress.Root>');
  return ctx;
}

function Root(props: UseVideoActionOptions<VideoCompressPreset> & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = useVideoCompress(options);
  return createElement(VideoCompressContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = useVideoCompressContext();
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

function PresetSwitcher(props: { renderButton?: (preset: VideoCompressPreset, active: boolean) => ReactNode }) {
  const ctx = useVideoCompressContext();
  const presets: VideoCompressPreset[] = ['balanced', 'high', 'small'];
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
  const ctx = useVideoCompressContext();
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

function RatioBadge(props: { format?: (ratio: number) => string }) {
  const ctx = useVideoCompressContext();
  if (ctx.ratio === null) return null;
  const text = props.format ? props.format(ctx.ratio) : `${ctx.ratio > 0 ? '-' : '+'}${Math.abs(ctx.ratio).toFixed(1)}%`;
  return createElement('span', { role: 'status', 'aria-label': 'Compression ratio' }, text);
}

function DownloadButton(props: { children?: ReactNode; filename?: string }) {
  const ctx = useVideoCompressContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download compressed video',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'compressed.mp4';
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
  const ctx = useVideoCompressContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = useVideoCompressContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const VideoCompress = { Root, Upload, PresetSwitcher, Preview, RatioBadge, DownloadButton, ErrorDisplay, ResetButton };

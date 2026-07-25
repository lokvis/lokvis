/**
 * VideoToGif — Layer 1 无样式复合组件(行为 + ARIA,零视觉)。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  useVideoToGif,
  type VideoToGifPreset,
  type UseVideoToGifResult,
} from '../hooks/useVideoToGif';
import type { UseVideoActionOptions } from '../hooks/useVideoCompress';
import { fileMatchesVideo, DefaultPresetButton } from './shared';

const VideoToGifContext = createContext<UseVideoToGifResult | null>(null);

export function useVideoToGifContext(): UseVideoToGifResult {
  const ctx = useContext(VideoToGifContext);
  if (!ctx) throw new Error('VideoToGif sub-components must be wrapped in <VideoToGif.Root>');
  return ctx;
}

function Root(props: UseVideoActionOptions<VideoToGifPreset> & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = useVideoToGif(options);
  return createElement(VideoToGifContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = useVideoToGifContext();
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

function PresetSwitcher(props: { renderButton?: (preset: VideoToGifPreset, active: boolean) => ReactNode }) {
  const ctx = useVideoToGifContext();
  const presets: VideoToGifPreset[] = ['standard', 'high'];
  return createElement(
    'div',
    { role: 'radiogroup', 'aria-label': 'GIF quality preset' },
    presets.map((p) =>
      props.renderButton
        ? createElement('span', { key: p, onClick: () => ctx.setPreset(p) }, props.renderButton(p, ctx.preset === p))
        : createElement(DefaultPresetButton, { key: p, active: ctx.preset === p, onClick: () => ctx.setPreset(p), label: p }, p)
    )
  );
}

function Preview(props: { type: 'input' | 'output' }) {
  const ctx = useVideoToGifContext();
  const urls = props.type === 'input' ? ctx.inputUrls : ctx.outputUrls;
  if (urls.length === 0) return null;
  // GIF output is an image, use <img> for output
  if (props.type === 'output') {
    return createElement(
      'div',
      { 'aria-label': 'output preview' },
      urls.map((url, i) =>
        createElement('img', { key: i, src: url, alt: 'GIF output', style: { maxWidth: '100%' } })
      )
    );
  }
  return createElement(
    'div',
    { 'aria-label': 'input preview' },
    urls.map((url, i) =>
      createElement('video', { key: i, src: url, controls: true, style: { maxWidth: '100%' } })
    )
  );
}

function DownloadButton(props: { children?: ReactNode; filename?: string }) {
  const ctx = useVideoToGifContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download GIF',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'output.gif';
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
  const ctx = useVideoToGifContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = useVideoToGifContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const VideoToGif = { Root, Upload, PresetSwitcher, Preview, DownloadButton, ErrorDisplay, ResetButton };

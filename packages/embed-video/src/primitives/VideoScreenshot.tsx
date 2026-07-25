/**
 * VideoScreenshot — Layer 1 无样式复合组件(行为 + ARIA,零视觉)。
 *
 * 预设:first / middle / custom;custom 时提供 time input。
 */
import {
  createContext,
  createElement,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  useVideoScreenshot,
  type VideoScreenshotPreset,
  type UseVideoScreenshotResult,
} from '../hooks/useVideoScreenshot';
import type { UseVideoActionOptions } from '../hooks/useVideoCompress';
import { fileMatchesVideo, DefaultPresetButton } from './shared';

const VideoScreenshotContext = createContext<UseVideoScreenshotResult | null>(null);

export function useVideoScreenshotContext(): UseVideoScreenshotResult {
  const ctx = useContext(VideoScreenshotContext);
  if (!ctx) throw new Error('VideoScreenshot sub-components must be wrapped in <VideoScreenshot.Root>');
  return ctx;
}

function Root(props: UseVideoActionOptions<VideoScreenshotPreset> & { children: ReactNode }) {
  const { children, ...options } = props;
  const state = useVideoScreenshot(options);
  return createElement(VideoScreenshotContext.Provider, { value: state }, children);
}

function Upload(props: { children?: ReactNode }) {
  const ctx = useVideoScreenshotContext();
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

function PresetSwitcher(props: { renderButton?: (preset: VideoScreenshotPreset, active: boolean) => ReactNode }) {
  const ctx = useVideoScreenshotContext();
  const presets: VideoScreenshotPreset[] = ['first', 'middle', 'custom'];
  return createElement(
    'div',
    { role: 'radiogroup', 'aria-label': 'Screenshot position' },
    presets.map((p) =>
      props.renderButton
        ? createElement('span', { key: p, onClick: () => ctx.setPreset(p) }, props.renderButton(p, ctx.preset === p))
        : createElement(DefaultPresetButton, { key: p, active: ctx.preset === p, onClick: () => ctx.setPreset(p), label: p }, p)
    )
  );
}

/** 自定义时间输入(preset=custom 时使用) */
function TimeInput(props: { label?: string }) {
  const ctx = useVideoScreenshotContext();
  return createElement(
    'div',
    { role: 'group', 'aria-label': 'Custom screenshot time' },
    createElement('label', { htmlFor: 'screenshot-time' }, props.label ?? 'Time (s)'),
    createElement('input', {
      id: 'screenshot-time',
      type: 'number',
      min: 0,
      step: 0.1,
      value: ctx.time,
      'aria-label': props.label ?? 'Screenshot time (seconds)',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => ctx.setTime(Number(e.target.value)),
    })
  );
}

function Preview(props: { type: 'input' | 'output' }) {
  const ctx = useVideoScreenshotContext();
  const urls = props.type === 'input' ? ctx.inputUrls : ctx.outputUrls;
  if (urls.length === 0) return null;
  // Screenshot output is an image
  if (props.type === 'output') {
    return createElement(
      'div',
      { 'aria-label': 'output preview' },
      urls.map((url, i) =>
        createElement('img', { key: i, src: url, alt: 'Screenshot output', style: { maxWidth: '100%' } })
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
  const ctx = useVideoScreenshotContext();
  const disabled = ctx.outputBlobs.length === 0 || ctx.busy;
  return createElement(
    'button',
    {
      type: 'button',
      disabled,
      'aria-label': 'Download screenshot',
      onClick: () => {
        if (ctx.outputBlobs[0]) {
          const url = URL.createObjectURL(ctx.outputBlobs[0]);
          const a = document.createElement('a');
          a.href = url;
          a.download = props.filename ?? 'screenshot.png';
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
  const ctx = useVideoScreenshotContext();
  if (!ctx.error) return null;
  return createElement('div', { role: 'alert' }, props.format ? props.format(ctx.error) : ctx.error);
}

function ResetButton(props: { children?: ReactNode }) {
  const ctx = useVideoScreenshotContext();
  return createElement(
    'button',
    { type: 'button', disabled: ctx.inputUrls.length === 0, 'aria-label': 'Reset', onClick: ctx.reset },
    props.children ?? 'Reset'
  );
}

export const VideoScreenshot = { Root, Upload, PresetSwitcher, TimeInput, Preview, DownloadButton, ErrorDisplay, ResetButton };

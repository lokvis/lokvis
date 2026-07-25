// @vitest-environment jsdom
/**
 * Layer 1 primitives 渲染测试。
 */
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { VideoTranscode } from '../primitives/VideoTranscode';

// mock useVideoTranscode hook 避免真实引擎调用
vi.mock('../hooks/useVideoTranscode', () => ({
  useVideoTranscode: () => ({
    ready: true,
    initError: null,
    inputUrls: [],
    inputInfos: [],
    outputUrls: [],
    outputInfos: [],
    outputBlobs: [],
    busy: false,
    error: null,
    preset: 'mp4' as const,
    handleFiles: vi.fn(),
    setPreset: vi.fn(),
    reset: vi.fn(),
    clearError: vi.fn(),
    run: vi.fn(),
  }),
  VIDEO_TRANSCODE_PRESETS: {
    mp4: { format: 'mp4' },
    webm: { format: 'webm' },
    gif: { format: 'gif' },
  },
}));

describe('VideoTranscode 原语', () => {
  it('Root 渲染子组件', () => {
    render(
      createElement(VideoTranscode.Root, {
        children: createElement('span', {}, 'hello transcode'),
      })
    );
    expect(screen.getByText('hello transcode')).toBeDefined();
  });

  it('Upload 渲染 role=button 的拖放区域', () => {
    render(
      createElement(VideoTranscode.Root, {
        children: createElement(VideoTranscode.Upload, {}, 'Drop here'),
      })
    );
    const dropZone = screen.getByRole('button', { name: 'Upload video file' });
    expect(dropZone).toBeDefined();
  });

  it('PresetSwitcher 渲染 radiogroup', () => {
    render(
      createElement(VideoTranscode.Root, {
        children: createElement(VideoTranscode.PresetSwitcher, {}),
      })
    );
    const group = screen.getByRole('radiogroup', { name: 'Transcode format' });
    expect(group).toBeDefined();
  });

  it('DownloadButton 无输出时 disabled', () => {
    render(
      createElement(VideoTranscode.Root, {
        children: createElement(VideoTranscode.DownloadButton, {}),
      })
    );
    const btn = screen.getByRole('button', { name: 'Download transcoded video' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('ErrorDisplay 无错误时不渲染', () => {
    const { container } = render(
      createElement(VideoTranscode.Root, {
        children: createElement(VideoTranscode.ErrorDisplay, {}),
      })
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('ResetButton 无输入时 disabled', () => {
    render(
      createElement(VideoTranscode.Root, {
        children: createElement(VideoTranscode.ResetButton, {}),
      })
    );
    const btn = screen.getByRole('button', { name: 'Reset' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

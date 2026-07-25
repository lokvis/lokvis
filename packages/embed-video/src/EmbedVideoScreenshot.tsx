/**
 * EmbedVideoScreenshot — 视频截图默认 UI(Layer 2)。
 *
 * 预设:first / middle / custom;custom 时显示 TimeInput。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedVideoTranslations } from './i18n/EmbedVideoI18nProvider';
import { themeToCssVars, useEmbedVideoMode, type EmbedVideoTheme, type EmbedVideoMode } from './theme';
import { VideoScreenshot, useVideoScreenshotContext } from './primitives/VideoScreenshot';
import type { VideoScreenshotPreset } from './hooks/useVideoScreenshot';
import type { UseVideoActionOptions } from './hooks/useVideoCompress';

export interface EmbedVideoScreenshotProps extends UseVideoActionOptions<VideoScreenshotPreset> {
  className?: string;
  style?: CSSProperties;
  showPresetSwitcher?: boolean;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedVideoTheme;
  mode?: EmbedVideoMode;
  locale?: Language;
  translations?: EmbedVideoTranslations;
}

/** 条件渲染 TimeInput(仅 preset=custom 时显示) */
function ConditionalTimeInput({ label }: { label: string }) {
  const ctx = useVideoScreenshotContext();
  if (ctx.preset !== 'custom') return null;
  return <VideoScreenshot.TimeInput label={label} />;
}

function EmbedVideoScreenshotInner({
  className = '',
  style,
  showPresetSwitcher = true,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  locale,
  translations,
  ...hookOptions
}: EmbedVideoScreenshotProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedVideoMode(mode);

  return (
    <div
      className={`lokvis-embed-video-screenshot ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-video-bg, transparent)',
        color: 'var(--lokvis-video-text, #18181b)',
        fontFamily: 'var(--lokvis-video-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <VideoScreenshot.Root {...hookOptions}>
        <header>
          <h2>{t('videoScreenshot.title')}</h2>
          <p>{t('videoScreenshot.subtitle')}</p>
          <VideoScreenshot.Upload>{t('videoScreenshot.dropHint')}</VideoScreenshot.Upload>
          {showPresetSwitcher && <VideoScreenshot.PresetSwitcher />}
          <ConditionalTimeInput label={t('videoScreenshot.timeLabel')} />
        </header>
        <div>
          <VideoScreenshot.Preview type="input" />
          <VideoScreenshot.Preview type="output" />
        </div>
        <footer>
          {showDownloadButton && <VideoScreenshot.DownloadButton>{t('videoScreenshot.download')}</VideoScreenshot.DownloadButton>}
          {showResetButton && <VideoScreenshot.ResetButton>{t('videoScreenshot.retry')}</VideoScreenshot.ResetButton>}
          <VideoScreenshot.ErrorDisplay />
        </footer>
      </VideoScreenshot.Root>
    </div>
  );
}

export default function EmbedVideoScreenshot(props: EmbedVideoScreenshotProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedVideoScreenshotInner {...props} />
    </ErrorBoundary>
  );
}

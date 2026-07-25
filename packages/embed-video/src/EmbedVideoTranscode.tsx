/**
 * EmbedVideoTranscode — 视频转码默认 UI(Layer 2)。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedVideoTranslations } from './i18n/EmbedVideoI18nProvider';
import { themeToCssVars, useEmbedVideoMode, type EmbedVideoTheme, type EmbedVideoMode } from './theme';
import { VideoTranscode } from './primitives/VideoTranscode';
import type { VideoTranscodePreset } from './hooks/useVideoTranscode';
import type { UseVideoActionOptions } from './hooks/useVideoCompress';

export interface EmbedVideoTranscodeProps extends UseVideoActionOptions<VideoTranscodePreset> {
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

function EmbedVideoTranscodeInner({
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
}: EmbedVideoTranscodeProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedVideoMode(mode);

  return (
    <div
      className={`lokvis-embed-video-transcode ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-video-bg, transparent)',
        color: 'var(--lokvis-video-text, #18181b)',
        fontFamily: 'var(--lokvis-video-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <VideoTranscode.Root {...hookOptions}>
        <header>
          <h2>{t('videoTranscode.title')}</h2>
          <p>{t('videoTranscode.subtitle')}</p>
          <VideoTranscode.Upload>{t('videoTranscode.dropHint')}</VideoTranscode.Upload>
          {showPresetSwitcher && <VideoTranscode.PresetSwitcher />}
        </header>
        <div>
          <VideoTranscode.Preview type="input" />
          <VideoTranscode.Preview type="output" />
        </div>
        <footer>
          {showDownloadButton && <VideoTranscode.DownloadButton>{t('videoTranscode.download')}</VideoTranscode.DownloadButton>}
          {showResetButton && <VideoTranscode.ResetButton>{t('videoTranscode.retry')}</VideoTranscode.ResetButton>}
          <VideoTranscode.ErrorDisplay />
        </footer>
      </VideoTranscode.Root>
    </div>
  );
}

export default function EmbedVideoTranscode(props: EmbedVideoTranscodeProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedVideoTranscodeInner {...props} />
    </ErrorBoundary>
  );
}

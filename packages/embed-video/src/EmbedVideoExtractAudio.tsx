/**
 * EmbedVideoExtractAudio — 视频提取音频默认 UI(Layer 2)。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedVideoTranslations } from './i18n/EmbedVideoI18nProvider';
import { themeToCssVars, useEmbedVideoMode, type EmbedVideoTheme, type EmbedVideoMode } from './theme';
import { VideoExtractAudio } from './primitives/VideoExtractAudio';
import type { VideoExtractAudioPreset } from './hooks/useVideoExtractAudio';
import type { UseVideoActionOptions } from './hooks/useVideoCompress';

export interface EmbedVideoExtractAudioProps extends UseVideoActionOptions<VideoExtractAudioPreset> {
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

function EmbedVideoExtractAudioInner({
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
}: EmbedVideoExtractAudioProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedVideoMode(mode);

  return (
    <div
      className={`lokvis-embed-video-extract-audio ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-video-bg, transparent)',
        color: 'var(--lokvis-video-text, #18181b)',
        fontFamily: 'var(--lokvis-video-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <VideoExtractAudio.Root {...hookOptions}>
        <header>
          <h2>{t('videoExtractAudio.title')}</h2>
          <p>{t('videoExtractAudio.subtitle')}</p>
          <VideoExtractAudio.Upload>{t('videoExtractAudio.dropHint')}</VideoExtractAudio.Upload>
          {showPresetSwitcher && <VideoExtractAudio.PresetSwitcher />}
        </header>
        <div>
          <VideoExtractAudio.Preview type="input" />
          <VideoExtractAudio.Preview type="output" />
        </div>
        <footer>
          {showDownloadButton && <VideoExtractAudio.DownloadButton>{t('videoExtractAudio.download')}</VideoExtractAudio.DownloadButton>}
          {showResetButton && <VideoExtractAudio.ResetButton>{t('videoExtractAudio.retry')}</VideoExtractAudio.ResetButton>}
          <VideoExtractAudio.ErrorDisplay />
        </footer>
      </VideoExtractAudio.Root>
    </div>
  );
}

export default function EmbedVideoExtractAudio(props: EmbedVideoExtractAudioProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedVideoExtractAudioInner {...props} />
    </ErrorBoundary>
  );
}

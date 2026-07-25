/**
 * EmbedVideoToGif — 视频转 GIF 默认 UI(Layer 2)。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedVideoTranslations } from './i18n/EmbedVideoI18nProvider';
import { themeToCssVars, useEmbedVideoMode, type EmbedVideoTheme, type EmbedVideoMode } from './theme';
import { VideoToGif } from './primitives/VideoToGif';
import type { VideoToGifPreset } from './hooks/useVideoToGif';
import type { UseVideoActionOptions } from './hooks/useVideoCompress';

export interface EmbedVideoToGifProps extends UseVideoActionOptions<VideoToGifPreset> {
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

function EmbedVideoToGifInner({
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
}: EmbedVideoToGifProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedVideoMode(mode);

  return (
    <div
      className={`lokvis-embed-video-to-gif ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-video-bg, transparent)',
        color: 'var(--lokvis-video-text, #18181b)',
        fontFamily: 'var(--lokvis-video-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <VideoToGif.Root {...hookOptions}>
        <header>
          <h2>{t('videoToGif.title')}</h2>
          <p>{t('videoToGif.subtitle')}</p>
          <VideoToGif.Upload>{t('videoToGif.dropHint')}</VideoToGif.Upload>
          {showPresetSwitcher && <VideoToGif.PresetSwitcher />}
        </header>
        <div>
          <VideoToGif.Preview type="input" />
          <VideoToGif.Preview type="output" />
        </div>
        <footer>
          {showDownloadButton && <VideoToGif.DownloadButton>{t('videoToGif.download')}</VideoToGif.DownloadButton>}
          {showResetButton && <VideoToGif.ResetButton>{t('videoToGif.retry')}</VideoToGif.ResetButton>}
          <VideoToGif.ErrorDisplay />
        </footer>
      </VideoToGif.Root>
    </div>
  );
}

export default function EmbedVideoToGif(props: EmbedVideoToGifProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedVideoToGifInner {...props} />
    </ErrorBoundary>
  );
}

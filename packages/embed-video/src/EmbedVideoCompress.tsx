/**
 * EmbedVideoCompress — 视频压缩默认 UI(Layer 2)。
 *
 * 基于 Layer 1 原语 + 内联样式,支持 theme / mode / locale / translations 定制。
 * 内置 ErrorBoundary。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedVideoTranslations } from './i18n/EmbedVideoI18nProvider';
import { themeToCssVars, useEmbedVideoMode, type EmbedVideoTheme, type EmbedVideoMode } from './theme';
import { VideoCompress } from './primitives/VideoCompress';
import type { UseVideoActionOptions, VideoCompressPreset } from './hooks/useVideoCompress';

export interface EmbedVideoCompressProps extends UseVideoActionOptions<VideoCompressPreset> {
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

function EmbedVideoCompressInner({
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
}: EmbedVideoCompressProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedVideoMode(mode);

  return (
    <div
      className={`lokvis-embed-video-compress ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-video-bg, transparent)',
        color: 'var(--lokvis-video-text, #18181b)',
        fontFamily: 'var(--lokvis-video-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <VideoCompress.Root {...hookOptions}>
        <header>
          <h2>{t('videoCompress.title')}</h2>
          <p>{t('videoCompress.subtitle')}</p>
          <VideoCompress.Upload>{t('videoCompress.dropHint')}</VideoCompress.Upload>
          {showPresetSwitcher && <VideoCompress.PresetSwitcher />}
        </header>
        <div>
          <VideoCompress.Preview type="input" />
          <VideoCompress.Preview type="output" />
        </div>
        <footer>
          {showDownloadButton && <VideoCompress.DownloadButton>{t('videoCompress.download')}</VideoCompress.DownloadButton>}
          {showResetButton && <VideoCompress.ResetButton>{t('videoCompress.retry')}</VideoCompress.ResetButton>}
          <VideoCompress.ErrorDisplay />
        </footer>
      </VideoCompress.Root>
    </div>
  );
}

export default function EmbedVideoCompress(props: EmbedVideoCompressProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedVideoCompressInner {...props} />
    </ErrorBoundary>
  );
}

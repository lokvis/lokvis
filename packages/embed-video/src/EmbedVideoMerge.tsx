/**
 * EmbedVideoMerge — 视频拼接默认 UI(Layer 2)。
 *
 * 多文件上传,无预设切换器。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedVideoTranslations } from './i18n/EmbedVideoI18nProvider';
import { themeToCssVars, useEmbedVideoMode, type EmbedVideoTheme, type EmbedVideoMode } from './theme';
import { VideoMerge } from './primitives/VideoMerge';
import type { UseVideoMergeOptions } from './hooks/useVideoMerge';

export interface EmbedVideoMergeProps extends UseVideoMergeOptions {
  className?: string;
  style?: CSSProperties;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedVideoTheme;
  mode?: EmbedVideoMode;
  locale?: Language;
  translations?: EmbedVideoTranslations;
}

function EmbedVideoMergeInner({
  className = '',
  style,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  locale,
  translations,
  ...hookOptions
}: EmbedVideoMergeProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedVideoMode(mode);

  return (
    <div
      className={`lokvis-embed-video-merge ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-video-bg, transparent)',
        color: 'var(--lokvis-video-text, #18181b)',
        fontFamily: 'var(--lokvis-video-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <VideoMerge.Root {...hookOptions}>
        <header>
          <h2>{t('videoMerge.title')}</h2>
          <p>{t('videoMerge.subtitle')}</p>
          <VideoMerge.Upload>{t('videoMerge.dropHint')}</VideoMerge.Upload>
        </header>
        <div>
          <VideoMerge.Preview type="input" />
          <VideoMerge.Preview type="output" />
        </div>
        <footer>
          {showDownloadButton && <VideoMerge.DownloadButton>{t('videoMerge.download')}</VideoMerge.DownloadButton>}
          {showResetButton && <VideoMerge.ResetButton>{t('videoMerge.retry')}</VideoMerge.ResetButton>}
          <VideoMerge.ErrorDisplay />
        </footer>
      </VideoMerge.Root>
    </div>
  );
}

export default function EmbedVideoMerge(props: EmbedVideoMergeProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedVideoMergeInner {...props} />
    </ErrorBoundary>
  );
}

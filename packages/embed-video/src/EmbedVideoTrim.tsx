/**
 * EmbedVideoTrim — 视频裁剪默认 UI(Layer 2)。
 *
 * 无预设切换器;包含 TimeInputs 用于设定裁剪起止时间。
 */
import type { CSSProperties } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useLang } from './i18n/useLang';
import { useTranslations } from './i18n/utils';
import type { Language } from './i18n/config';
import type { EmbedVideoTranslations } from './i18n/EmbedVideoI18nProvider';
import { themeToCssVars, useEmbedVideoMode, type EmbedVideoTheme, type EmbedVideoMode } from './theme';
import { VideoTrim } from './primitives/VideoTrim';
import type { UseVideoTrimOptions } from './hooks/useVideoTrim';

export interface EmbedVideoTrimProps extends UseVideoTrimOptions {
  className?: string;
  style?: CSSProperties;
  showDownloadButton?: boolean;
  showResetButton?: boolean;
  theme?: EmbedVideoTheme;
  mode?: EmbedVideoMode;
  locale?: Language;
  translations?: EmbedVideoTranslations;
}

function EmbedVideoTrimInner({
  className = '',
  style,
  showDownloadButton = true,
  showResetButton = true,
  theme,
  mode = 'system',
  locale,
  translations,
  ...hookOptions
}: EmbedVideoTrimProps) {
  const lang = useLang(locale);
  const t = useTranslations(lang, translations);
  const cssVars = themeToCssVars(theme);
  const resolvedMode = useEmbedVideoMode(mode);

  return (
    <div
      className={`lokvis-embed-video-trim ${className}`}
      data-embed-mode={resolvedMode}
      style={{
        background: 'var(--lokvis-video-bg, transparent)',
        color: 'var(--lokvis-video-text, #18181b)',
        fontFamily: 'var(--lokvis-video-font-family, inherit)',
        ...cssVars,
        ...style,
      }}
    >
      <VideoTrim.Root {...hookOptions}>
        <header>
          <h2>{t('videoTrim.title')}</h2>
          <p>{t('videoTrim.subtitle')}</p>
          <VideoTrim.Upload>{t('videoTrim.dropHint')}</VideoTrim.Upload>
          <VideoTrim.TimeInputs startLabel={t('videoTrim.startTime')} endLabel={t('videoTrim.endTime')} />
        </header>
        <div>
          <VideoTrim.Preview type="input" />
          <VideoTrim.Preview type="output" />
        </div>
        <footer>
          {showDownloadButton && <VideoTrim.DownloadButton>{t('videoTrim.download')}</VideoTrim.DownloadButton>}
          {showResetButton && <VideoTrim.ResetButton>{t('videoTrim.retry')}</VideoTrim.ResetButton>}
          <VideoTrim.ErrorDisplay />
        </footer>
      </VideoTrim.Root>
    </div>
  );
}

export default function EmbedVideoTrim(props: EmbedVideoTrimProps) {
  return (
    <ErrorBoundary locale={props.locale} translations={props.translations}>
      <EmbedVideoTrimInner {...props} />
    </ErrorBoundary>
  );
}

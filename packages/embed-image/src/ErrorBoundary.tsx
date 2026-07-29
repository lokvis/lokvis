/**
 * ErrorBoundary(@lokvis/embed-image 内部副本)。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂,注入 --lokvis-* 命名空间与
 * QuickI18nContext。以本包原有导出名 ErrorBoundary 再导出,Props 不变。
 *
 * 重试计数由工厂统一实现(实例字段累积,MAX_RETRY=3 后隐藏重试按钮)。
 */
import { createEmbedErrorBoundary } from '@lokvis/embed-kit';
import { captureException } from './internal/sentry';
import { getLangFromUrl, t } from './i18n/utils';
import { QuickI18nContext } from './i18n/EmbedI18nProvider';

export const ErrorBoundary = createEmbedErrorBoundary({
  cssPrefix: '--lokvis',
  i18nContext: QuickI18nContext,
  t,
  getLangFromUrl,
  captureException,
});

/**
 * Playground Quick Action 适配层(W23 解耦 i18n)。
 *
 * 职责:把 playground 的 useLang / useTranslations 多语言文案系统映射成
 * 独立的 QuickStrings,然后包到 QuickStringsProvider 里。Layer 2 的 6 个
 * ImageQuick* 组件本身不再依赖 playground i18n,三方接入方可以直接用
 * DEFAULT_QUICK_STRINGS(英文)或注入自己的 strings。
 *
 * 用法(在 astro 页面里):
 *   ---
 *   import { PlaygroundImageQuickCompress } from '@/components/tools/quick/playground';
 *   ---
 *   <PlaygroundImageQuickCompress client:only="react" initialPreset="balanced" />
 *
 * 6 个 wrapper 一一对应 6 个 ImageQuick*。Props 透传,无任何修改。
 */
import type { ComponentType } from 'react';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';
import {
  QuickStringsProvider,
  type QuickStrings,
} from '.';
import ImageQuickCompress, { type ImageQuickCompressProps } from './ImageQuickCompress';
import ImageQuickResize, { type ImageQuickResizeProps } from './ImageQuickResize';
import ImageQuickConvert, { type ImageQuickConvertProps } from './ImageQuickConvert';
import ImageQuickWatermark, { type ImageQuickWatermarkProps } from './ImageQuickWatermark';
import ImageQuickCrop, { type ImageQuickCropProps } from './ImageQuickCrop';
import ImageQuickPipeline, { type ImageQuickPipelineProps } from './ImageQuickPipeline';

/**
 * 把 playground i18n 的 key 映射成 QuickStrings 对象。
 *
 * 与 apps/playground/src/i18n/ui.ts 中的 quick*.* key 一一对应。
 * 缺失的 key 会回落到 undefined(useQuickStrings 在 Provider 上层有 default,
 * 但 Provider value 是完整对象,这里若返回 undefined 会被 React 当作"使用 Provider value",
 * 因此缺失 key 时直接返回 key 字符串作 fallback,避免空白)。
 */
function usePlaygroundQuickStrings(): QuickStrings {
  const lang = useLang();
  const t = useTranslations(lang);
  return {
    compress: {
      title: t('quickCompress.title'),
      subtitle: t('quickCompress.subtitle'),
      download: t('quickCompress.download'),
      retry: t('quickCompress.retry'),
    },
    resize: {
      title: t('quickResize.title'),
      subtitle: t('quickResize.subtitle'),
      download: t('quickResize.download'),
      retry: t('quickResize.retry'),
    },
    convert: {
      title: t('quickConvert.title'),
      subtitle: t('quickConvert.subtitle'),
      download: t('quickConvert.download'),
      retry: t('quickConvert.retry'),
    },
    watermark: {
      title: t('quickWatermark.title'),
      subtitle: t('quickWatermark.subtitle'),
      download: t('quickWatermark.download'),
      retry: t('quickWatermark.retry'),
    },
    crop: {
      title: t('quickCrop.title'),
      subtitle: t('quickCrop.subtitle'),
      cropArea: t('quickCrop.cropArea'),
      download: t('quickCrop.download'),
      retry: t('quickCrop.retry'),
    },
    pipeline: {
      title: t('quickPipeline.title'),
      subtitle: t('quickPipeline.subtitle'),
      steps: t('quickPipeline.steps'),
      download: t('quickPipeline.download'),
      retry: t('quickPipeline.retry'),
    },
  };
}

/**
 * 通用工厂:包一层 QuickStringsProvider,把 playground i18n 注入子树。
 *
 * 用于在 astro 页面里 client:only="react" 渲染时,自动接入 playground 多语言。
 */
function withPlaygroundStrings<P extends object>(
  Wrapped: ComponentType<P>
): ComponentType<P> {
  function Wrapper(props: P) {
    const strings = usePlaygroundQuickStrings();
    return (
      <QuickStringsProvider value={strings}>
        <Wrapped {...props} />
      </QuickStringsProvider>
    );
  }
  Wrapper.displayName = `Playground${Wrapped.displayName ?? Wrapped.name ?? 'Component'}`;
  return Wrapper;
}

// ─── 6 个 playground 适配组件 ────────────────────────────

export const PlaygroundImageQuickCompress = withPlaygroundStrings(ImageQuickCompress);
export const PlaygroundImageQuickResize = withPlaygroundStrings(ImageQuickResize);
export const PlaygroundImageQuickConvert = withPlaygroundStrings(ImageQuickConvert);
export const PlaygroundImageQuickWatermark = withPlaygroundStrings(ImageQuickWatermark);
export const PlaygroundImageQuickCrop = withPlaygroundStrings(ImageQuickCrop);
export const PlaygroundImageQuickPipeline = withPlaygroundStrings(ImageQuickPipeline);

// 类型再导出,便于 astro 页面 TS 检查
export type {
  ImageQuickCompressProps,
  ImageQuickResizeProps,
  ImageQuickConvertProps,
  ImageQuickWatermarkProps,
  ImageQuickCropProps,
  ImageQuickPipelineProps,
};

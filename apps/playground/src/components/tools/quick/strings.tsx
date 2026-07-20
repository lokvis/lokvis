/**
 * Quick Action 文案系统(W23 解耦 playground i18n)。
 *
 * 设计目标:
 *   - Layer 2 默认 UI 不再依赖 playground 的 useLang / useTranslations
 *   - 三方接入方有两个选项:
 *     1. 不传 strings → 使用 DEFAULT_QUICK_STRINGS(英文)
 *     2. 通过 <QuickStringsProvider value={...}> 注入自定义文案(任意语言)
 *   - playground 自身通过 playground.tsx 适配层把 useLang/useTranslations
 *     映射成 QuickStrings,然后包到 Provider 里
 *
 * 架构:
 *   <QuickStringsProvider value={zhStrings}>
 *     <ImageQuickCompress />  // 内部 useQuickStrings() 读 context
 *   </QuickStringsProvider>
 *
 * 后续抽离为 @lokvis/quick-image 时,本文件可直接迁出,无 playground 依赖。
 */
import { createContext, useContext, type ReactNode } from 'react';

// ─── 类型定义 ─────────────────────────────────────────────

/** 单个 Quick 家族的通用文案(title/subtitle/download/retry) */
export interface QuickFamilyStrings {
  title: string;
  subtitle: string;
  download: string;
  retry: string;
}

/** Crop 家族额外有 cropArea,Pipeline 家族额外有 steps,Watermark 暂无额外 */
export interface QuickCompressStrings extends QuickFamilyStrings {}
export interface QuickResizeStrings extends QuickFamilyStrings {}
export interface QuickConvertStrings extends QuickFamilyStrings {}
export interface QuickWatermarkStrings extends QuickFamilyStrings {}
export interface QuickCropStrings extends QuickFamilyStrings {
  cropArea: string;
}
export interface QuickPipelineStrings extends QuickFamilyStrings {
  steps: string;
}

/** 全部 6 个 Quick 家族的文案集合 */
export interface QuickStrings {
  compress: QuickCompressStrings;
  resize: QuickResizeStrings;
  convert: QuickConvertStrings;
  watermark: QuickWatermarkStrings;
  crop: QuickCropStrings;
  pipeline: QuickPipelineStrings;
}

// ─── 默认文案(英文)─────────────────────────────────────

/**
 * 默认文案(英文)。与 apps/playground/src/i18n/ui.ts 的 en 字段保持一致,
 * 三方接入方不传 strings 时使用此默认值。
 */
export const DEFAULT_QUICK_STRINGS: QuickStrings = {
  compress: {
    title: 'Quick Compress',
    subtitle: 'Drop image → auto compress to WebP',
    download: 'Download',
    retry: 'Try another',
  },
  resize: {
    title: 'Quick Resize',
    subtitle: 'Drop image → resize to preset',
    download: 'Download',
    retry: 'Try another',
  },
  convert: {
    title: 'Quick Convert',
    subtitle: 'Drop image → convert to target format',
    download: 'Download',
    retry: 'Try another',
  },
  watermark: {
    title: 'Quick Watermark',
    subtitle: 'Drop image → apply watermark preset',
    download: 'Download',
    retry: 'Try another',
  },
  crop: {
    title: 'Quick Crop',
    subtitle: 'Drop image → crop to preset ratio',
    cropArea: 'Crop Area',
    download: 'Download',
    retry: 'Try another',
  },
  pipeline: {
    title: 'Quick Pipeline',
    subtitle: 'Drop image → run multi-step pipeline',
    steps: 'Steps',
    download: 'Download',
    retry: 'Try another',
  },
};

// ─── Context + Provider + Hook ───────────────────────────

const QuickStringsContext = createContext<QuickStrings>(DEFAULT_QUICK_STRINGS);

/** Provider:把自定义文案注入到子树所有 ImageQuick* / Quick*.Root 中 */
export function QuickStringsProvider({
  value,
  children,
}: {
  value: QuickStrings;
  children: ReactNode;
}) {
  return (
    <QuickStringsContext.Provider value={value}>
      {children}
    </QuickStringsContext.Provider>
  );
}

/**
 * 读取当前文案。
 *
 * 默认返回 DEFAULT_QUICK_STRINGS(英文)。
 * 上层用 <QuickStringsProvider value={...}> 注入时可覆盖。
 */
export function useQuickStrings(): QuickStrings {
  return useContext(QuickStringsContext);
}

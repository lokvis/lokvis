/**
 * 平台尺寸预设的类型定义。
 *
 * 类型独立成文件,供 `platform-manual.ts`(手工数据)、`platform.generated.ts`
 * (codegen 产物)与 `platform.ts`(辅助函数)共享,避免循环导入。
 *
 * 数据来源与生成机制见 `platform.ts` 顶部说明与 `scripts/codegen-platform-presets.ts`。
 */

/** 平台预设用途分类(供选择器分组展示) */
export type PlatformPresetCategory =
  | 'social'
  | 'ecommerce'
  | 'video'
  | 'print'
  | 'other';

/** 推荐输出格式 */
export type PlatformRecommendedFormat = 'png' | 'jpeg' | 'webp';

/**
 * resize fit 策略(与 engine-image FitStrategy 取值对齐)。
 *
 * - `cover`:缩放并裁剪溢出部分(填满目标尺寸)
 * - `contain`:缩放并在不足处留白(完整可见)
 * - `fill`:拉伸到目标尺寸(可能变形)
 * - `inside`:等比缩放到目标尺寸内(可能小于目标)
 * - `outside`:等比缩放到目标尺寸外(可能大于目标)
 */
export type PlatformFitStrategy = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/**
 * 平台尺寸预设的来源标注。
 *
 * - `knowledge`:由 `@lokvis/data-platforms`(lokvis-knowledge 仓)codegen 生成,
 *   数值以知识仓为唯一事实源(Knowledge 存 Facts 铁律)。
 * - `manual`:尚未迁入知识仓的手工预设(覆盖知识仓暂未收录的平台/尺寸),
 *   属过渡态,应逐步以带来源的数据补入知识仓后由 codegen 接管。
 */
export type PlatformPresetSource = 'knowledge' | 'manual';

/**
 * 平台尺寸预设。
 *
 * 字段语义:
 * - `width`/`height`:目标像素尺寸。resize 按此尺寸缩放,crop 按此尺寸居中裁剪
 * - `recommendedFormat`:多数平台 JPEG/WebP 兼容性最好;含透明背景用 PNG
 * - `recommendedFit`:resize 时建议的 fit 策略(`cover` 裁掉溢出 / `contain` 留黑边)
 * - `source`:数据来源标注(见 {@link PlatformPresetSource})
 */
export interface PlatformSizePreset {
  /** 全局唯一 ID,如 `youtube.thumbnail` */
  id: string;
  /** 平台名,如 `YouTube` */
  platform: string;
  /** 该尺寸的具体用途名,如 `Thumbnail (1280×720)` */
  name: string;
  /** 目标宽度(像素) */
  width: number;
  /** 目标高度(像素) */
  height: number;
  /** 用途分类 */
  category: PlatformPresetCategory;
  /** 用途描述(可选) */
  description?: string;
  /** 推荐输出格式(可选) */
  recommendedFormat?: PlatformRecommendedFormat;
  /** 推荐 fit 策略(可选,默认 cover) */
  recommendedFit?: PlatformFitStrategy;
  /** 数据来源(可选,缺省视为 manual) */
  source?: PlatformPresetSource;
}

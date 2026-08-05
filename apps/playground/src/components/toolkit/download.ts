/**
 * 图片信息工具(playground toolkit,FO-16 工厂化)。
 *
 * 图片专属分析函数统一从 @lokvis/embed-image 导入,消除副本。
 */
export {
  getImageInfo,
  imageInfoToMeta,
  detectTransparency,
} from '@lokvis/embed-image';
export type { ImageInfo } from '@lokvis/embed-image';

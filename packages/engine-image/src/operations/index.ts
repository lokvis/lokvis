/**
 * 图像操作(聚合入口)
 *
 * 按操作类别拆分到独立文件,此处统一 re-export,
 * 外部导入路径 `@lokvis/engine-image` 保持不变。
 *
 * O-8:public API 收敛 — 仅暴露 Blob↔Blob 操作函数(AGENTS.md 约定:
 * Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow)。内部工具
 * (utils / compress-target / tiles / png-metadata)不通过 public API
 * 导出,测试代码通过相对路径直接 import 内部模块。
 *
 * 当前已实现(Blob↔Blob 公共操作):
 * - transform.ts:       几何变换(resize / crop / rotate / flip)
 * - encode.ts:          编码与格式(compress / convert / setBackground)
 * - watermark.ts:       水印(文字 / 图片)
 * - filters.ts:         简单滤镜(grayscale / invert / sepia / blur)
 * - ico.ts:             ICO favicon 多尺寸容器编码(encodeIco)
 *
 * 内部模块(不导出,仅供同包其他操作文件引用):
 * - compress-target.ts: 目标体积压缩(compress 内部二分查找实现)
 * - png-metadata.ts:    PNG DPI 嵌入(transform 内部使用)
 * - utils.ts:           共享工具(throwIfAborted / inferFormat / computeTargetSize)
 * - tiles.ts:           大图分片(watermark 内部使用)
 *
 * 注:EXIF 元数据读取未放本层 —— readExif 是 Blob→ExifData 查询,不符合
 * AGENTS.md 规定的 Engine 层 Blob↔Blob 纯函数约束。实现位于 Capability 层
 * (plugin-image/src/exif-reader.ts),通过 MetadataReader 机制注册给 Runtime。
 */
export * from './transform.js';
export * from './encode.js';
export * from './watermark.js';
export * from './filters.js';
export * from './ico.js';

/**
 * 编码格式支持检测(@lokvis/embed-image 内部工具)。
 *
 * ADR-015(A6):原自包含实现(1×1 画布真实编码 + MIME 比对)已收敛到
 * @lokvis/browser-adapter 的 FormatSupportProbe,与 engine-image 的
 * detectFormatSupport 共用同一实现,消除三处重复探测逻辑的漂移风险。
 *
 * 本模块保留为 re-export:hooks 的导入路径与测试的 vi.mock 路径不变。
 */

export { detectEncodeSupport } from '@lokvis/browser-adapter';

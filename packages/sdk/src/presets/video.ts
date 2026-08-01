/**
 * @lokvis/sdk/video — Composition root preset for video processing.
 *
 * Embed packages import from here instead of @lokvis/plugin-video directly,
 * keeping the dependency arrow: UI → SDK → Capability (not UI → Capability).
 */
export { videoToolsPluginWeb } from '@lokvis/plugin-video/web';
export { configureFfmpegWasm, type FfmpegWasmConfig } from '@lokvis/engine-video/web';

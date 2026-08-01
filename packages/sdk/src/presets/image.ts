/**
 * @lokvis/sdk/image — Composition root preset for image processing.
 *
 * Embed packages import from here instead of @lokvis/plugin-image directly,
 * keeping the dependency arrow: UI → SDK → Capability (not UI → Capability).
 */
export { imageToolsPlugin, wasmEncodersEnabled } from '@lokvis/plugin-image';

/**
 * @lokvis/sdk/pdf — Composition root preset for PDF processing.
 *
 * Embed packages import from here instead of @lokvis/plugin-pdf directly,
 * keeping the dependency arrow: UI → SDK → Capability (not UI → Capability).
 */
export { pdfToolsPluginWeb } from '@lokvis/plugin-pdf/web';

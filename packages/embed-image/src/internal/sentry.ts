/**
 * Sentry captureException 占位实现(@lokvis/embed-image 内部副本)。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂,仅注入包标签 'embed-image'。
 * 三方接入时可替换 ErrorBoundary 内的 captureException,
 * 或在应用层用 Sentry SDK 初始化后,通过模块替换覆盖本函数。
 *
 * 默认行为:console.error(与 apps/playground/src/toolkit/sentry.ts 一致)。
 */
import { createCaptureException } from '@lokvis/embed-kit';

export const captureException = createCaptureException('embed-image');

/**
 * Sentry captureException 占位实现(@lokvis/embed-pdf 内部副本)。
 *
 * 复用 @lokvis/embed-kit 的参数化工厂,仅注入包标签 'embed-pdf'。
 * 三方接入时可替换 ErrorBoundary 内的 captureException,
 * 或在应用层用 Sentry SDK 初始化后,通过模块替换覆盖本函数。
 *
 * 默认行为:console.error。
 */
import { createCaptureException } from '@lokvis/embed-kit';

export const captureException = createCaptureException('embed-pdf');

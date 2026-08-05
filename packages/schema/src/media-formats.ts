/**
 * 媒体格式映射表(FO-14 单一事实源)
 *
 * 统一 MIME ↔ format ↔ ext ↔ AssetType 映射,消除 engine-image / browser-adapter /
 * engine-video / engine-audio / engine-core / mcp-server / embed-image / playground
 * 此前各自维护的重复映射表。
 *
 * 设计约束:
 * - 纯数据 + 纯函数,无运行时依赖,任何层均可安全 import
 * - engine 特有映射(如 ffmpeg codecForFormat)保留在各 engine 包,但引用本文件的基础格式键
 * - 新增格式时只需在本文件添加一行,所有消费方自动同步
 */

import type { AssetType } from './asset.js';

/** format → MIME 单一映射表(覆盖 image/video/audio 全部格式) */
export const MIME_BY_FORMAT: Record<string, string> = {
  // image
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  // video
  mp4: 'video/mp4',
  webm: 'video/webm',
  // audio
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

/** format → 文件扩展名(jpeg→jpg 特例) */
export const EXT_BY_FORMAT: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  avif: 'avif',
  gif: 'gif',
  mp4: 'mp4',
  webm: 'webm',
  mp3: 'mp3',
  aac: 'aac',
  wav: 'wav',
  ogg: 'ogg',
  flac: 'flac',
};

/** 扩展名 → format(jpg→jpeg 规范化) */
export const FORMAT_BY_EXT: Record<string, string> = {
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  webp: 'webp',
  avif: 'avif',
  gif: 'gif',
  mp4: 'mp4',
  webm: 'webm',
  mp3: 'mp3',
  aac: 'aac',
  wav: 'wav',
  ogg: 'ogg',
  flac: 'flac',
};

/** format → AssetType */
export const ASSET_TYPE_BY_FORMAT: Record<string, AssetType> = {
  png: 'image',
  jpeg: 'image',
  webp: 'image',
  avif: 'image',
  gif: 'image',
  mp4: 'video',
  webm: 'video',
  mp3: 'audio',
  aac: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
};

/** format → MIME,未知格式返回 fallback */
export function mimeForFormat(format: string, fallback = 'application/octet-stream'): string {
  return MIME_BY_FORMAT[format] ?? fallback;
}

/** format → 扩展名,未知格式返回 fallback */
export function extForFormat(format: string, fallback = 'bin'): string {
  return EXT_BY_FORMAT[format] ?? fallback;
}

/** 扩展名 → format(jpg 规范化为 jpeg),未知扩展名返回 undefined */
export function formatFromExt(ext: string): string | undefined {
  return FORMAT_BY_EXT[ext.toLowerCase()];
}

/** 扩展名 → MIME,未知扩展名返回 fallback */
export function mimeFromExt(ext: string, fallback = 'application/octet-stream'): string {
  const format = formatFromExt(ext);
  return format ? mimeForFormat(format) : fallback;
}

/** format → AssetType,未知格式返回 'unknown' */
export function assetTypeForFormat(format: string): AssetType {
  return ASSET_TYPE_BY_FORMAT[format] ?? 'unknown';
}

/** MIME → format 显示名(大写,如 'image/jpeg' → 'JPEG') */
export function formatFromMime(mime: string): string {
  const sub = mime.split('/')[1] ?? 'unknown';
  const main = sub.split('+')[0] ?? sub;
  return main.toUpperCase();
}

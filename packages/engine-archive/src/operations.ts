/**
 * engine-archive 操作实现 — Blob↔Blob 纯函数(基于 fflate,浏览器/Node 同构)。
 *
 * AGENTS.md:
 * - Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow
 * - 操作函数统一接受 `Record<string, any>` 参数(供 plugin 层无断言直传)
 *
 * fflate 为纯 JS 零 WASM 实现,zipSync/unzipSync 同步 API 在浏览器与 Node 一致;
 * 大文件内存守卫由 Runtime 批处理层负责(Engine 不能 import L4 的 MemoryGuard)。
 */

import { zipSync, unzipSync } from 'fflate';
import type { ArchiveEntry } from './types.js';

/** 常见 MIME → 扩展名(用于 zip 缺省文件名) */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/json': '.json',
  'audio/mpeg': '.mp3',
  'video/mp4': '.mp4',
};

/** 扩展名 → MIME(用于 unzip 输出 Blob 的 type) */
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  json: 'application/json',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

function extFromMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? '';
}

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

async function blobToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** 保证归档内文件名唯一(同名追加 -1/-2 …) */
function uniqueName(taken: Record<string, unknown>, name: string): string {
  if (!(name in taken)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  let candidate = `${base}-${i}${ext}`;
  while (candidate in taken) {
    i += 1;
    candidate = `${base}-${i}${ext}`;
  }
  return candidate;
}

/**
 * 将多个 Blob 打包为单个 zip Blob(N→1)。
 *
 * @param blobs 输入条目
 * @param params `{ names?: string[]; level?: number }`
 */
export async function zipBlobs(
  blobs: Blob[],
  params: Record<string, any>
): Promise<Blob> {
  const names = Array.isArray(params.names) ? (params.names as string[]) : undefined;
  const level = typeof params.level === 'number' ? params.level : 6;
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < blobs.length; i++) {
    const desired = names?.[i] ?? `file-${i}${extFromMime(blobs[i]!.type)}`;
    files[uniqueName(files, desired)] = await blobToU8(blobs[i]!);
  }
  const zipped = zipSync(files, { level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
  return new Blob([zipped], { type: 'application/zip' });
}

/**
 * 将单个 zip Blob 解包为多个 Blob(1→N),输出顺序与归档条目顺序一致。
 */
export async function unzipBlob(
  blob: Blob,
  _params: Record<string, any>
): Promise<Blob[]> {
  const u8 = await blobToU8(blob);
  const entries = unzipSync(u8);
  return Object.entries(entries).map(
    ([name, data]) => new Blob([data], { type: mimeFromName(name) })
  );
}

/**
 * 列举 zip Blob 的条目清单,输出 `application/json` Blob(1→1)。
 *
 * JSON 形状:`{ count: number; entries: { name: string; size: number }[] }`。
 */
export async function listArchive(
  blob: Blob,
  _params: Record<string, any>
): Promise<Blob> {
  const u8 = await blobToU8(blob);
  const entries = unzipSync(u8);
  const list: ArchiveEntry[] = Object.entries(entries).map(([name, data]) => ({
    name,
    size: data.length,
  }));
  const json = JSON.stringify({ count: list.length, entries: list }, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * MCP tool 共享文件系统辅助函数。
 *
 * image.ts / pdf.ts 的 tool handler 都需要 file-path ↔ Blob 翻译、
 * 输出路径生成、文件大小读取与格式化,统一抽到本模块消除重复。
 *
 * 架构定位:Node 应用侧的 I/O 翻译层,不属于五层架构的任何一层
 * (Engine 层只接收 Blob,tool handler 负责文件 I/O 翻译)。
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, basename, extname, join } from 'node:path';

/** 读取文件为 Blob(带指定 MIME,供 engine 推断格式) */
export async function fileToBlob(path: string, mime: string): Promise<Blob> {
  const buffer = await readFile(path);
  return new Blob([buffer], { type: mime });
}

/** 把 Blob 写入文件 */
export async function blobToFile(blob: Blob, path: string): Promise<void> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  await writeFile(path, buffer);
}

/** 生成输出路径:输入路径加后缀,如 `image.png` → `image_resized.png` */
export function makeOutputPath(
  inputPath: string,
  suffix: string,
  defaultExt: string,
  newExt?: string
): string {
  const dir = dirname(inputPath);
  const base = basename(inputPath, extname(inputPath));
  const ext = newExt || extname(inputPath).slice(1) || defaultExt;
  return join(dir, `${base}_${suffix}.${ext}`);
}

/** 获取文件大小(字节) */
export async function getFileSize(path: string): Promise<number> {
  const stats = await stat(path);
  return stats.size;
}

/** 格式化文件大小(人类可读) */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

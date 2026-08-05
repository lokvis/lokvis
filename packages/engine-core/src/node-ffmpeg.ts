/**
 * engine-core · Node 端 ffmpeg 共享基建（FO-11）
 *
 * 抽取 engine-video / engine-audio 重复的 ffmpeg 调用逻辑：
 * - getFfmpegPath: 动态导入 ffmpeg-static 获取二进制路径
 * - runFfmpegStdio: stdin/stdout 管道流式处理
 * - runFfmpegConcatMerge: concat demuxer 合并多文件（需临时文件）
 * - validateTrimRange: trim 参数校验
 * - mimeTypeForFormat: 格式→MIME 映射
 *
 * 设计约束：
 * - 不依赖具体 engine 包，只依赖 Node 标准 API
 * - 错误文案模板保持原样（stderr 尾部 2000 字符）
 * - 各 engine 包通过 import 复用，消除 ~150 行重复代码
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** ffmpeg-static 动态导入（可选 peerDependency，缺失时抛错） */
export async function getFfmpegPath(): Promise<string> {
  try {
    const mod = await import('ffmpeg-static');
    return (mod as { default: string }).default;
  } catch (err) {
    throw new Error(
      `ffmpeg-static is required for Node-side operations. ` +
        `Install it with: pnpm add ffmpeg-static. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** 支持的输出格式（video + audio 并集） */
export type OutputFormat =
  | 'mp4'
  | 'webm'
  | 'gif'
  | 'mp3'
  | 'aac'
  | 'wav'
  | 'ogg'
  | 'flac'
  | 'png'
  | 'jpeg'
  | 'webp';

/** 根据输出格式推断 MIME 类型 */
export function mimeTypeForFormat(format: OutputFormat | string): string {
  switch (format) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'gif': return 'image/gif';
    case 'mp3': return 'audio/mpeg';
    case 'aac': return 'audio/aac';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'flac': return 'audio/flac';
    case 'png': return 'image/png';
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

/**
 * 脱敏 ffmpeg stderr 中的敏感路径信息 (FO-06 安全增强)
 *
 * @param stderr 原始 stderr 输出
 * @returns 脱敏后的字符串
 */
function sanitizeStderr(stderr: string): string {
  // Windows 路径 (C:\Users\xxx\..., D:\temp\...)
  let sanitized = stderr.replace(/[A-Z]:\\(?:[^:\\]+\\)+[^\s]*/gi, '[PATH]');
  
  // Unix/macOS 标准路径 (/tmp/, /var/folders/.../)
  sanitized = sanitized.replace(/\/tmp\/[a-zA-Z0-9._-]+/g, '[TMP_PATH]');
  sanitized = sanitized.replace(/\/var\/folders\/[a-z0-9]+\/[a-z0-9]+\/[A-Za-z0-9]+\.d\/[a-z0-9]+\//g, '[CACHE_PATH]');
  sanitized = sanitized.replace(/\/home\/[^\/]+\/[^\/\s]+/g, '[HOME_PATH]');
  sanitized = sanitized.replace(/\/Users\/[^\/\/]+/g, '[USER_PATH]');
  
  return sanitized;
}

/**
 * 运行 ffmpeg 子进程，通过 stdin 输入、stdout 输出。
 *
 * @param args ffmpeg 命令行参数（不含 ffmpeg 本身）
 * @param inputBlob 输入 Blob（写入 stdin）
 * @param outputMimeType 输出 MIME 类型（用于构造 Blob）
 * @returns 输出 Blob
 */
export async function runFfmpegStdio(
  args: string[],
  inputBlob: Blob,
  outputMimeType: string
): Promise<Blob> {
  const ffmpegPath = await getFfmpegPath();
  const fullArgs = ['-i', 'pipe:0', ...args, 'pipe:1'];

  return new Promise<Blob>((resolve, reject) => {
    const proc = spawn(ffmpegPath, fullArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderrData = '';

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg spawn failed: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const buffer = Buffer.concat(chunks);
        resolve(new Blob([new Uint8Array(buffer)], { type: outputMimeType }));
      } else {
        reject(
          new Error(
            `ffmpeg exited with code ${code}. stderr: ${sanitizeStderr(stderrData.slice(-2000))}`
          )
        );
      }
    });

    inputBlob.arrayBuffer().then((ab) => {
      proc.stdin.write(new Uint8Array(ab));
      proc.stdin.end();
    }).catch((err) => {
      reject(new Error(`Failed to read input blob: ${err}`));
      proc.kill();
    });
  });
}

/**
 * 使用 concat demuxer 合并多个 Blob（需临时文件）。
 *
 * @param blobs 输入 Blob 数组
 * @param inputExt 输入文件扩展名（如 'mp4'、'mp3'）
 * @param outputMimeType 输出 MIME 类型
 * @param extraArgs 额外的 ffmpeg 参数（如 '-c copy'）
 * @returns 合并后的 Blob
 */
export async function runFfmpegConcatMerge(
  blobs: Blob[],
  inputExt: string,
  outputMimeType: string,
  extraArgs: string[] = []
): Promise<Blob> {
  const ffmpegPath = await getFfmpegPath();
  const tempDir = await mkdtemp(join(tmpdir(), 'engine-core-merge-'));

  try {
    // 写入所有输入到临时文件
    const inputPaths: string[] = [];
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      if (!blob) continue;
      const path = join(tempDir, `input_${i}.${inputExt}`);
      const buffer = Buffer.from(await blob.arrayBuffer());
      await writeFile(path, buffer);
      inputPaths.push(path);
    }

    // 创建 concat 列表
    const concatListPath = join(tempDir, 'concat_list.txt');
    const concatListContent = inputPaths.map((p) => `file '${p}'`).join('\n');
    await writeFile(concatListPath, concatListContent);

    // 运行 ffmpeg concat demuxer
    const args = ['-f', 'concat', '-safe', '0', '-i', concatListPath, ...extraArgs, 'pipe:1'];

    return new Promise<Blob>((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      const chunks: Buffer[] = [];
      let stderrData = '';

      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString();
      });

      proc.on('error', (err) => {
        reject(new Error(`ffmpeg concat spawn failed: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const buffer = Buffer.concat(chunks);
          resolve(new Blob([new Uint8Array(buffer)], { type: outputMimeType }));
        } else {
          reject(
            new Error(
              `ffmpeg concat exited with code ${code}. stderr: ${sanitizeStderr(stderrData.slice(-2000))}`
            )
          );
        }
      });
    });
  } finally {
    // 清理临时目录
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * 校验 trim 时间范围参数。
 *
 * @param start 开始时间（秒）
 * @param end 结束时间（秒，可选）
 * @param duration 总时长（秒，用于校验 end 不超过）
 */
export function validateTrimRange(
  start: number,
  end: number | undefined,
  duration?: number
): void {
  if (start < 0) {
    throw new Error(`trim: start must be >= 0, got ${start}`);
  }
  if (end !== undefined) {
    if (end <= start) {
      throw new Error(`trim: end (${end}) must be > start (${start})`);
    }
    if (duration !== undefined && end > duration) {
      throw new Error(`trim: end (${end}) exceeds duration (${duration})`);
    }
  }
}

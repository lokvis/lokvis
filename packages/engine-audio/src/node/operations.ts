/**
 * engine-audio Node 端操作实装(基于 ffmpeg-static)
 *
 * 与浏览器版 `../operations.ts` 的区别:
 * - 浏览器版所有操作为 stub(避免加载 lamejs + Web Audio 解码器)
 * - Node 版用 ffmpeg-static 提供的预编译 ffmpeg 二进制,通过 child_process 调用
 *
 * 4 个真实操作:
 * - trimAudio(1→1):按时间范围截取
 * - mergeAudios(N→1):concat demuxer 合并
 * - transcodeAudio(1→1):转换容器/编解码
 * - normalizeAudio(1→1):loudnorm 滤镜标准化响度
 *
 * 设计:
 * - 操作函数签名与浏览器版完全一致(Blob → Blob + Record<string, any>)
 * - 通过 stdin/stdout 管道流式处理,避免临时文件(merge 除外,需 concat 列表)
 * - 使用 ffmpeg-static 提供的预编译二进制路径,无需系统 ffmpeg
 *
 * AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow。
 * 不依赖 DOM API,仅用 Node 标准 API(child_process / fs / os / path)。
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AudioTrimParams,
  AudioMergeParams,
  AudioTranscodeParams,
  AudioNormalizeParams,
  AudioOutputFormat,
} from '../types.js';
import {
  getFfmpegPath,
  mimeTypeForFormat,
  runFfmpegStdio,
  validateTrimRange,
} from '@lokvis/engine-core';

/** 根据输出格式选择 ffmpeg 编解码器 */
function codecForFormat(format: AudioOutputFormat): string {
  switch (format) {
    case 'mp3': return 'libmp3lame';
    case 'wav': return 'pcm_s16le';
    case 'ogg': return 'libvorbis';
    case 'aac': return 'aac';
    default: return 'libmp3lame';
  }
}

/**
 * 裁剪音频片段(Blob → Blob)。
 *
 * 使用 -ss / -t 实现快速 seek + 拷贝(关键帧对齐);若需精确帧裁剪,
 * 可去掉 -c copy 并重编码。这里取折中:重编码避免 seek 精度问题。
 *
 * @param blob 输入音频 Blob
 * @param params 裁剪参数(start / end,单位秒)
 */
export async function trimAudio(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as AudioTrimParams;
  if (typeof p.start !== 'number' || typeof p.end !== 'number') {
    throw new Error('trimAudio: start and end are required (in seconds)');
  }
  validateTrimRange(p.start, p.end);
  const duration = p.end - p.start;
  // -ss 在 -i 之前:快速 seek;-t 指定持续时间;-c copy:不重编码(速度极快)
  // 注:对于音频,-c copy 通常足够精确(音频帧边界比视频关键帧更细)
  const args = ['-ss', String(p.start), '-t', String(duration), '-c', 'copy'];
  // 输出格式跟随输入 MIME,默认 mp3
  const outputMime = blob.type && blob.type !== 'application/octet-stream'
    ? blob.type
    : 'audio/mpeg';
  return runFfmpegStdio(args, blob, outputMime);
}

/**
 * 合并多个音频(Blob[] → Blob)。
 *
 * 使用 ffmpeg concat demuxer(要求输入格式/编解码一致)。
 *
 * @param blobs 输入音频 Blob 数组(至少 2 个)
 * @param params 合并参数(format)
 */
export async function mergeAudios(
  blobs: Blob[],
  params: Record<string, any> = {}
): Promise<Blob> {
  if (!Array.isArray(blobs) || blobs.length < 2) {
    throw new Error(`mergeAudios: at least 2 inputs required, got ${blobs?.length ?? 0}`);
  }
  const p = params as AudioMergeParams;
  const format: AudioOutputFormat = p.format ?? 'mp3';
  // concat demuxer 需要 list 文件,只能用临时文件模式
  const tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-audio-merge-'));
  try {
    const inputExt = format;
    const inputPaths: string[] = [];
    for (let i = 0; i < blobs.length; i++) {
      const inputPath = join(tmpDir, `input-${i}.${inputExt}`);
      const buf = new Uint8Array(await blobs[i]!.arrayBuffer());
      await writeFile(inputPath, buf);
      inputPaths.push(inputPath);
    }
    const listPath = join(tmpDir, 'concat-list.txt');
    const listContent = inputPaths.map((ip) => `file '${ip}'`).join('\n');
    await writeFile(listPath, listContent, 'utf-8');

    const outputPath = join(tmpDir, `output.${format}`);
    const ffmpegPath = await getFfmpegPath();

    return new Promise<Blob>((resolve, reject) => {
      // -f concat:使用 concat demuxer;-c copy:不重编码
      const proc = spawn(
        ffmpegPath,
        ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let stderrData = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderrData += chunk.toString();
      });
      proc.on('error', (err) => {
        reject(new Error(`ffmpeg spawn failed: ${err.message}`));
      });
      proc.on('close', async (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `ffmpeg merge exited with code ${code}. stderr: ${stderrData.slice(-2000)}`
            )
          );
          return;
        }
        try {
          const outBuf = await readFile(outputPath);
          resolve(new Blob([new Uint8Array(outBuf)], { type: mimeTypeForFormat(format) }));
        } catch (err) {
          reject(new Error(`Failed to read merge output: ${err}`));
        }
      });
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {
      // 临时目录清理失败不影响主流程
    });
  }
}

/**
 * 音频转码(Blob → Blob)。
 *
 * @param blob 输入音频 Blob
 * @param params 转码参数(format 必填 / bitrate)
 */
export async function transcodeAudio(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as AudioTranscodeParams;
  if (!p.format) {
    throw new Error('transcodeAudio: format is required');
  }
  const args: string[] = ['-vn']; // 丢弃视频流(若有)
  args.push('-c:a', codecForFormat(p.format));
  if (p.bitrate !== undefined) {
    args.push('-b:a', String(p.bitrate));
  }
  return runFfmpegStdio(args, blob, mimeTypeForFormat(p.format));
}

/**
 * 音频标准化(Blob → Blob)— 使用 ffmpeg loudnorm 滤镜(EBUR128 响度标准化)。
 *
 * @param blob 输入音频 Blob
 * @param params 标准化参数(level,目标响度 dB,默认 -16 LUFS)
 */
export async function normalizeAudio(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as AudioNormalizeParams;
  const targetLufs = typeof p.level === 'number' ? p.level : -16;
  if (targetLufs < -70 || targetLufs > 0) {
    throw new Error(
      `normalizeAudio: level must be in [-70, 0] dB, got ${targetLufs}`
    );
  }
  // loudnorm 滤镜:I=target loudness,TP=true peak,LRA=range
  // 输出格式跟随输入 MIME,默认 mp3
  const args = [
    '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`,
    '-c:a', 'libmp3lame',
  ];
  const outputMime = blob.type && blob.type !== 'application/octet-stream'
    ? blob.type
    : 'audio/mpeg';
  return runFfmpegStdio(args, blob, outputMime);
}

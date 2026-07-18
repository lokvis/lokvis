/**
 * engine-video Node 端操作实装(基于 ffmpeg-static)
 *
 * 与浏览器版 `../operations.ts` 的区别:
 * - 浏览器版所有操作为 stub(避免加载 ffmpeg.wasm ~30MB)
 * - Node 版用 ffmpeg-static 提供的预编译 ffmpeg 二进制,通过 child_process 调用
 *
 * 7 个真实操作:
 * - compressVideo(1→1):调整比特率/CRF/缩放
 * - transcodeVideo(1→1):转换容器/编解码
 * - trimVideo(1→1):按时间范围截取
 * - mergeVideos(N→1):concat demuxer 合并
 * - extractAudio(1→1):提取音频轨
 * - toGif(1→1):视频转 GIF(含调色板)
 * - screenshotVideo(1→1):指定时间点截图
 * - getVideoInfo:ffprobe 解析元数据
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
  VideoCompressParams,
  VideoTranscodeParams,
  VideoTrimParams,
  VideoMergeParams,
  VideoExtractAudioParams,
  VideoToGifParams,
  VideoScreenshotParams,
  VideoInfo,
  VideoOutputFormat,
} from '../types.js';

/** ffmpeg-static 动态导入(可选 peerDependency,缺失时抛错) */
async function getFfmpegPath(): Promise<string> {
  try {
    const mod = await import('ffmpeg-static');
    // ffmpeg-static 默认导出 ffmpeg 二进制路径(string)
    return (mod as { default: string }).default;
  } catch (err) {
    throw new Error(
      `ffmpeg-static is required for Node-side video operations. ` +
        `Install it with: pnpm add ffmpeg-static. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** 根据输出格式推断 MIME 类型 */
function mimeTypeForFormat(format: VideoOutputFormat | 'mp3' | 'aac' | 'wav' | 'png' | 'jpeg' | 'webp'): string {
  switch (format) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'gif': return 'image/gif';
    case 'mp3': return 'audio/mpeg';
    case 'aac': return 'audio/aac';
    case 'wav': return 'audio/wav';
    case 'png': return 'image/png';
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

/**
 * 运行 ffmpeg 子进程,通过 stdin 输入、stdout 输出。
 *
 * @param args ffmpeg 命令行参数(不含 ffmpeg 本身)
 * @param inputBlob 输入 Blob(写入 stdin)
 * @param outputMimeType 输出 MIME 类型(用于构造 Blob)
 * @returns 输出 Blob
 */
async function runFfmpegStdio(
  args: string[],
  inputBlob: Blob,
  outputMimeType: string
): Promise<Blob> {
  const ffmpegPath = await getFfmpegPath();
  // ffmpeg 参数:-i pipe:0(从 stdin 读) ... pipe:1(写 stdout)
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
            `ffmpeg exited with code ${code}. stderr: ${stderrData.slice(-2000)}`
          )
        );
      }
    });

    // 写入输入 Blob 到 stdin
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
 * 压缩视频(Blob → Blob)。
 *
 * @param blob 输入视频 Blob
 * @param params 压缩参数(format/bitrate/crf/scale)
 */
export async function compressVideo(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as VideoCompressParams;
  const format = p.format ?? 'mp4';
  if (format === 'gif') {
    throw new Error('compressVideo: use toGif for GIF output');
  }
  const args: string[] = [];
  if (p.crf !== undefined) {
    args.push('-crf', String(p.crf));
  }
  if (p.bitrate !== undefined) {
    args.push('-b:v', String(p.bitrate));
  }
  if (p.scale !== undefined) {
    if (p.scale < 0 || p.scale > 1) {
      throw new Error(`compressVideo: scale must be 0-1, got ${p.scale}`);
    }
    // 视频 filter:缩放(保持宽高比)
    args.push('-vf', `scale=iw*${p.scale}:ih*${p.scale}`);
  }
  // 默认使用 H.264 + yuv420p 像素格式(最大兼容性)
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  return runFfmpegStdio(args, blob, mimeTypeForFormat(format));
}

/**
 * 转码视频(Blob → Blob)。
 *
 * @param blob 输入视频 Blob
 * @param params 转码参数(format 必填 / codec / bitrate / crf)
 */
export async function transcodeVideo(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as VideoTranscodeParams;
  if (!p.format) {
    throw new Error('transcodeVideo: format is required');
  }
  if (p.format === 'gif') {
    // GIF 转换走 toGif 操作(含调色板)
    throw new Error('transcodeVideo: use toGif for GIF output');
  }
  const args: string[] = [];
  if (p.codec) {
    args.push('-c:v', p.codec);
  }
  if (p.bitrate !== undefined) {
    args.push('-b:v', String(p.bitrate));
  }
  if (p.crf !== undefined) {
    args.push('-crf', String(p.crf));
  }
  args.push('-movflags', '+faststart');
  return runFfmpegStdio(args, blob, mimeTypeForFormat(p.format));
}

/**
 * 裁剪视频片段(Blob → Blob)。
 *
 * @param blob 输入视频 Blob
 * @param params 裁剪参数(start / end,单位秒)
 */
export async function trimVideo(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as VideoTrimParams;
  if (typeof p.start !== 'number' || typeof p.end !== 'number') {
    throw new Error('trimVideo: start and end are required (in seconds)');
  }
  if (p.start < 0 || p.end < 0) {
    throw new Error(`trimVideo: start and end must be >= 0, got start=${p.start} end=${p.end}`);
  }
  if (p.start >= p.end) {
    throw new Error(`trimVideo: start must be < end, got start=${p.start} end=${p.end}`);
  }
  // -ss 在 -i 之前:快速 seek(关键帧对齐);-to 指定结束时间
  // -c copy:不重编码,直接拷贝(速度极快)
  // 注:对于精确帧裁剪,需要去掉 -c copy 并重编码,这里取折中
  const duration = p.end - p.start;
  const args = ['-ss', String(p.start), '-t', String(duration), '-c', 'copy'];
  return runFfmpegStdio(args, blob, 'video/mp4');
}

/**
 * 合并多个视频(Blob[] → Blob)。
 *
 * 使用 ffmpeg concat demuxer(要求输入格式/编解码一致)。
 *
 * @param blobs 输入视频 Blob 数组(至少 2 个)
 * @param params 合并参数(format / transition)
 */
export async function mergeVideos(
  blobs: Blob[],
  params: Record<string, any> = {}
): Promise<Blob> {
  if (!Array.isArray(blobs) || blobs.length < 2) {
    throw new Error(`mergeVideos: at least 2 inputs required, got ${blobs?.length ?? 0}`);
  }
  const p = params as VideoMergeParams;
  const format = p.format ?? 'mp4';
  if (format === 'gif') {
    throw new Error('mergeVideos: GIF merge not supported, use toGif after merge');
  }
  if (p.transition && p.transition !== 'none') {
    throw new Error(
      `mergeVideos: transition "${p.transition}" not yet implemented (Phase 3+)`
    );
  }
  // concat demuxer 需要 list 文件,只能用临时文件模式
  // 注:此处简化处理,要求所有输入为相同格式
  const tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-merge-'));
  try {
    // 写入输入文件(扩展名根据 format 推断)
    const inputExt = format;
    const inputPaths: string[] = [];
    for (let i = 0; i < blobs.length; i++) {
      const inputPath = join(tmpDir, `input-${i}.${inputExt}`);
      const buf = new Uint8Array(await blobs[i]!.arrayBuffer());
      await writeFile(inputPath, buf);
      inputPaths.push(inputPath);
    }
    // 创建 concat list 文件
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
 * 从视频提取音频轨(Blob → Blob)。
 *
 * @param blob 输入视频 Blob
 * @param params 音频参数(format / bitrate)
 */
export async function extractAudio(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as VideoExtractAudioParams;
  const format = p.format ?? 'mp3';
  const args: string[] = ['-vn']; // 丢弃视频流
  if (p.bitrate !== undefined) {
    args.push('-b:a', String(p.bitrate));
  }
  // 编解码器根据格式选择
  switch (format) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame');
      break;
    case 'aac':
      args.push('-c:a', 'aac');
      break;
    case 'wav':
      args.push('-c:a', 'pcm_s16le');
      break;
  }
  return runFfmpegStdio(args, blob, mimeTypeForFormat(format));
}

/**
 * 将视频(或片段)转换为 GIF(Blob → Blob)。
 *
 * 使用两遍法:第一遍生成调色板,第二遍应用调色板(画质更好)。
 *
 * @param blob 输入视频 Blob
 * @param params GIF 参数(start / end / fps / width)
 */
export async function toGif(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as VideoToGifParams;
  // 时间范围过滤
  const trimArgs: string[] = [];
  if (p.start !== undefined) {
    trimArgs.push('-ss', String(p.start));
  }
  if (p.end !== undefined && p.start !== undefined) {
    trimArgs.push('-t', String(p.end - p.start));
  } else if (p.end !== undefined) {
    trimArgs.push('-to', String(p.end));
  }
  // 帧率与宽度
  const fps = p.fps ?? 15;
  const vfParts: string[] = [`fps=${fps}`];
  if (p.width !== undefined) {
    if (p.width <= 0) {
      throw new Error(`toGif: width must be > 0, got ${p.width}`);
    }
    vfParts.push(`scale=${p.width}:-1:flags=lanczos`);
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-gif-'));
  try {
    const palettePath = join(tmpDir, 'palette.png');
    const outputPath = join(tmpDir, 'output.gif');
    const ffmpegPath = await getFfmpegPath();

    // 写入输入
    const inputPath = join(tmpDir, 'input.mp4');
    const inputBuf = new Uint8Array(await blob.arrayBuffer());
    await writeFile(inputPath, inputBuf);

    const runFfmpeg = (args: string[]): Promise<void> => {
      return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, ['-y', ...args], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderrData = '';
        proc.stderr.on('data', (chunk: Buffer) => {
          stderrData += chunk.toString();
        });
        proc.on('error', (err) => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}. stderr: ${stderrData.slice(-2000)}`));
        });
      });
    };

    // 第一遍:生成调色板
    await runFfmpeg([
      ...trimArgs,
      '-i', inputPath,
      '-vf', `${vfParts.join(',')},palettegen`,
      palettePath,
    ]);

    // 第二遍:应用调色板生成 GIF
    await runFfmpeg([
      ...trimArgs,
      '-i', inputPath,
      '-i', palettePath,
      '-lavfi', `${vfParts.join(',')},paletteuse=dither=bayer:bayer_scale=5`,
      outputPath,
    ]);

    const outBuf = await readFile(outputPath);
    return new Blob([new Uint8Array(outBuf)], { type: 'image/gif' });
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {
      // 临时目录清理失败不影响主流程
    });
  }
}

/**
 * 视频截图(Blob → Blob)— 在指定时间点截取一帧。
 *
 * @param blob 输入视频 Blob
 * @param params 截图参数(time 必填 / format)
 */
export async function screenshotVideo(
  blob: Blob,
  params: Record<string, any> = {}
): Promise<Blob> {
  const p = params as VideoScreenshotParams;
  if (typeof p.time !== 'number' || p.time < 0) {
    throw new Error(`screenshotVideo: time is required and must be >= 0, got ${p.time}`);
  }
  const format = p.format ?? 'png';
  // -ss 在 -i 之前:快速 seek;-frames:v 1:只取一帧
  const args = ['-ss', String(p.time), '-frames:v', '1'];
  switch (format) {
    case 'png':
      args.push('-c:v', 'png');
      break;
    case 'jpeg':
      args.push('-c:v', 'mjpeg', '-q:v', '2');
      break;
    case 'webp':
      args.push('-c:v', 'libwebp');
      break;
  }
  return runFfmpegStdio(args, blob, mimeTypeForFormat(format));
}

/**
 * 读取视频基本信息(分辨率/时长/帧率/编解码)。
 *
 * 通过 ffprobe 解析(包含在 ffmpeg-static 中)。
 *
 * @param blob 输入视频 Blob
 */
export async function getVideoInfo(blob: Blob): Promise<VideoInfo> {
  const ffmpegPath = await getFfmpegPath();
  // ffprobe 通常与 ffmpeg 同目录
  const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');

  return new Promise<VideoInfo>((resolve, reject) => {
    // 用 -i pipe:0 读 stdin,-show_format -show_streams -of json 输出 JSON
    const proc = spawn(
      ffprobePath,
      ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', 'pipe:0'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const chunks: Buffer[] = [];
    let stderrData = '';
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString();
    });
    proc.on('error', (err) => {
      reject(new Error(`ffprobe spawn failed: ${err.message}`));
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}. stderr: ${stderrData}`));
        return;
      }
      try {
        const json = JSON.parse(Buffer.concat(chunks).toString()) as {
          format?: { duration?: string };
          streams?: Array<{
            codec_type?: string;
            codec_name?: string;
            width?: number;
            height?: number;
            r_frame_rate?: string;
          }>;
        };
        const videoStream = json.streams?.find((s) => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('getVideoInfo: no video stream found'));
          return;
        }
        // r_frame_rate 形如 "30/1" 或 "30000/1001"
        const fpsParts = (videoStream.r_frame_rate ?? '0/1').split('/');
        const fpsNum = Number(fpsParts[0] ?? 0);
        const fpsDen = Number(fpsParts[1] ?? 1);
        const fps = fpsDen === 0 ? 0 : fpsNum / fpsDen;
        resolve({
          width: videoStream.width ?? 0,
          height: videoStream.height ?? 0,
          duration: Number(json.format?.duration ?? 0),
          fps,
          codec: videoStream.codec_name ?? 'unknown',
        });
      } catch (err) {
        reject(new Error(`getVideoInfo: failed to parse ffprobe output: ${err}`));
      }
    });
    blob.arrayBuffer().then((ab) => {
      proc.stdin.write(new Uint8Array(ab));
      proc.stdin.end();
    }).catch((err) => {
      reject(new Error(`Failed to read input blob: ${err}`));
      proc.kill();
    });
  });
}

// 重导出类型(供消费方 import)
export type {
  VideoOutputFormat,
  VideoTranscodeParams,
  VideoTrimParams,
  VideoCompressParams,
  VideoMergeParams,
  VideoExtractAudioParams,
  VideoToGifParams,
  VideoScreenshotParams,
  VideoInfo,
} from '../types.js';

/**
 * engine-video 浏览器端操作实装(基于 ffmpeg.wasm)
 *
 * 与 Node 端 `../node/operations.ts` 的区别:
 * - Node 版用 ffmpeg-static 预编译二进制 + child_process
 * - 浏览器版用 @ffmpeg/ffmpeg(wasm 编译的 ffmpeg)在 Web Worker 中执行
 *
 * 7 个真实操作 + getVideoInfo:
 * - compressVideo(1→1):调整比特率/CRF/缩放
 * - transcodeVideo(1→1):转换容器/编解码
 * - trimVideo(1→1):按时间范围截取
 * - mergeVideos(N→1):concat demuxer 合并
 * - extractAudio(1→1):提取音频轨
 * - toGif(1→1):视频转 GIF(含调色板两遍法)
 * - screenshotVideo(1→1):指定时间点截图
 * - getVideoInfo:解析视频元数据(分辨率/时长/帧率/编解码)
 *
 * 设计:
 * - 操作函数签名与浏览器 stub 版及 Node 版完全一致(Blob → Blob + Record<string, any>)
 * - 通过 ffmpeg.wasm 虚拟文件系统读写,避免真实 I/O
 * - 单例 FFmpeg 实例懒加载(首次操作时 ~32MB wasm 按需拉取)
 * - 每次操作使用唯一文件名前缀,避免并发冲突
 *
 * AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow。
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg';
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
import { getFfmpegInstance } from './ffmpeg-instance.js';
import { mimeForFormat, extForFormat as schemaExtForFormat } from '@lokvis/schema';

/** 操作计数器(生成唯一文件名,避免并发冲突) */
let opCounter = 0;
function nextId(): string {
  return `op_${Date.now()}_${++opCounter}`;
}

/**
 * ffmpeg 虚拟文件系统清理(best-effort,FO-07)。
 *
 * 清理失败仅意味着残留临时文件(下次操作覆盖/实例销毁即消失),
 * 不应中断主流程;但不再静默吞错,以 console.debug 记录便于排查
 * FS 泄漏类问题(TD-3.x 清偿口径)。
 */
async function safeDeleteFile(ffmpeg: FFmpeg, name: string): Promise<void> {
  await ffmpeg.deleteFile(name).catch((err) => {
    console.debug(`[lokvis:engine-video] ffmpeg FS cleanup failed (${name}):`, err);
  });
}

/** 根据输出格式推断 MIME 类型(委托 @lokvis/schema 单一映射表,FO-14) */
function mimeTypeForFormat(
  format: VideoOutputFormat | 'mp3' | 'aac' | 'wav' | 'png' | 'jpeg' | 'webp' | 'gif'
): string {
  return mimeForFormat(format);
}

/** 根据格式推断文件扩展名(委托 @lokvis/schema 单一映射表,FO-14) */
function localExtForFormat(format: string): string {
  return schemaExtForFormat(format);
}

/** 从 Blob.type 推断视频输入扩展名(用于 ffmpeg 虚拟文件系统命名) */
function inputExtFromBlob(blob: Blob): string {
  if (blob.type.includes('webm')) return 'webm';
  if (blob.type.includes('mp4')) return 'mp4';
  if (blob.type.includes('ogg') || blob.type.includes('ogv')) return 'ogv';
  if (blob.type.includes('avi')) return 'avi';
  if (blob.type.includes('mov') || blob.type.includes('quicktime')) return 'mov';
  if (blob.type.includes('mkv') || blob.type.includes('matroska')) return 'mkv';
  // 默认 mp4(ffmpeg 按内容检测,扩展名仅辅助)
  return 'mp4';
}

/**
 * 执行单次 ffmpeg 操作(单输入 → 单输出)
 *
 * @param ffmpeg FFmpeg 实例
 * @param inputBlob 输入 Blob
 * @param inputExt 输入文件扩展名
 * @param preInputArgs 放在 -i 之前的参数(如 -ss 用于快速 seek)
 * @param postInputArgs 放在 -i 之后、输出文件之前的参数
 * @param outputExt 输出文件扩展名
 * @param outputMime 输出 MIME 类型
 */
async function runSingleOp(
  ffmpeg: FFmpeg,
  inputBlob: Blob,
  inputExt: string,
  preInputArgs: string[],
  postInputArgs: string[],
  outputExt: string,
  outputMime: string
): Promise<Blob> {
  const id = nextId();
  const inputName = `${id}_in.${inputExt}`;
  const outputName = `${id}_out.${outputExt}`;

  try {
    const inputData = new Uint8Array(await inputBlob.arrayBuffer());
    await ffmpeg.writeFile(inputName, inputData);
    await ffmpeg.exec([...preInputArgs, '-i', inputName, ...postInputArgs, outputName]);
    const outputData = await ffmpeg.readFile(outputName) as Uint8Array;
    return new Blob([outputData.slice()], { type: outputMime });
  } finally {
    // 清理虚拟文件系统
    await safeDeleteFile(ffmpeg, inputName);
    await safeDeleteFile(ffmpeg, outputName);
  }
}

/**
 * 压缩视频(Blob → Blob)
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

  const ffmpeg = await getFfmpegInstance();
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
    args.push('-vf', `scale=iw*${p.scale}:ih*${p.scale}`);
  }

  // H.264 + yuv420p(最大兼容性)
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');

  return runSingleOp(ffmpeg, blob, inputExtFromBlob(blob), [], args, localExtForFormat(format), mimeTypeForFormat(format));
}

/**
 * 转码视频(Blob → Blob)
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
    throw new Error('transcodeVideo: use toGif for GIF output');
  }

  const ffmpeg = await getFfmpegInstance();
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

  return runSingleOp(ffmpeg, blob, inputExtFromBlob(blob), [], args, localExtForFormat(p.format), mimeTypeForFormat(p.format));
}

/**
 * 裁剪视频片段(Blob → Blob)
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

  const ffmpeg = await getFfmpegInstance();
  const duration = p.end - p.start;
  // -ss 在 -i 之前:快速 seek(关键帧对齐);-c copy:不重编码(速度极快)
  // 输出容器与输入一致(stream copy 不能跨容器)
  const inputExt = inputExtFromBlob(blob);
  const preInput = ['-ss', String(p.start)];
  const postInput = ['-t', String(duration), '-c', 'copy'];
  const outputMime = inputExt === 'webm' ? 'video/webm' : 'video/mp4';

  return runSingleOp(ffmpeg, blob, inputExt, preInput, postInput, inputExt, outputMime);
}

/**
 * 合并多个视频(Blob[] → Blob)
 *
 * 使用 ffmpeg concat demuxer(要求输入格式/编解码一致)。
 *
 * @param blobs 输入视频 Blob 数组(至少 2 个)
 * @param params 合并参数(format)
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

  const ffmpeg = await getFfmpegInstance();
  const id = nextId();
  const inputNames: string[] = [];
  const listName = `${id}_list.txt`;
  const outputName = `${id}_out.${localExtForFormat(format)}`;

  try {
    // 写入所有输入文件
    for (let i = 0; i < blobs.length; i++) {
      const name = `${id}_in${i}.${localExtForFormat(format)}`;
      const data = new Uint8Array(await blobs[i]!.arrayBuffer());
      await ffmpeg.writeFile(name, data);
      inputNames.push(name);
    }

    // 创建 concat list
    const listContent = inputNames.map((n) => `file '${n}'`).join('\n');
    await ffmpeg.writeFile(listName, new TextEncoder().encode(listContent));

    // 执行合并
    await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', listName, '-c', 'copy', outputName]);

    const outputData = await ffmpeg.readFile(outputName) as Uint8Array;
    return new Blob([outputData.slice()], { type: mimeTypeForFormat(format) });
  } finally {
    for (const name of inputNames) {
      await safeDeleteFile(ffmpeg, name);
    }
    await safeDeleteFile(ffmpeg, listName);
    await safeDeleteFile(ffmpeg, outputName);
  }
}

/**
 * 从视频提取音频轨(Blob → Blob)
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

  const ffmpeg = await getFfmpegInstance();
  const args: string[] = ['-vn']; // 丢弃视频流

  if (p.bitrate !== undefined) {
    args.push('-b:a', String(p.bitrate));
  }
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

  const inputExt = inputExtFromBlob(blob);
  return runSingleOp(ffmpeg, blob, inputExt, [], args, localExtForFormat(format), mimeTypeForFormat(format));
}

/**
 * 将视频(或片段)转换为 GIF(Blob → Blob)
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

  const ffmpeg = await getFfmpegInstance();
  const id = nextId();
  const inputName = `${id}_in.${inputExtFromBlob(blob)}`;
  const paletteName = `${id}_palette.png`;
  const outputName = `${id}_out.gif`;

  try {
    const inputData = new Uint8Array(await blob.arrayBuffer());
    await ffmpeg.writeFile(inputName, inputData);

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
    const vf = vfParts.join(',');

    // 第一遍:生成调色板
    await ffmpeg.exec([
      ...trimArgs,
      '-i', inputName,
      '-vf', `${vf},palettegen`,
      paletteName,
    ]);

    // 第二遍:应用调色板生成 GIF
    await ffmpeg.exec([
      ...trimArgs,
      '-i', inputName,
      '-i', paletteName,
      '-lavfi', `${vf},paletteuse=dither=bayer:bayer_scale=5`,
      outputName,
    ]);

    const outputData = await ffmpeg.readFile(outputName) as Uint8Array;
    return new Blob([outputData.slice()], { type: 'image/gif' });
  } finally {
    await safeDeleteFile(ffmpeg, inputName);
    await safeDeleteFile(ffmpeg, paletteName);
    await safeDeleteFile(ffmpeg, outputName);
  }
}

/**
 * 视频截图(Blob → Blob)— 在指定时间点截取一帧
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

  const ffmpeg = await getFfmpegInstance();
  // -ss 在 -i 之前:快速 seek 到指定时间点;-frames:v 1:只取一帧
  const preInput = ['-ss', String(p.time)];
  const postInput: string[] = ['-frames:v', '1'];
  switch (format) {
    case 'png':
      postInput.push('-c:v', 'png');
      break;
    case 'jpeg':
      postInput.push('-c:v', 'mjpeg', '-q:v', '2');
      break;
    case 'webp':
      postInput.push('-c:v', 'libwebp');
      break;
  }

  return runSingleOp(ffmpeg, blob, inputExtFromBlob(blob), preInput, postInput, localExtForFormat(format), mimeTypeForFormat(format));
}

/**
 * 读取视频基本信息(分辨率/时长/帧率/编解码)
 *
 * 通过 ffmpeg -i 的日志输出解析元数据(ffmpeg.wasm 不含独立 ffprobe)。
 *
 * @param blob 输入视频 Blob
 */
export async function getVideoInfo(blob: Blob): Promise<VideoInfo> {
  const ffmpeg = await getFfmpegInstance();
  const id = nextId();
  const inputName = `${id}_in.${inputExtFromBlob(blob)}`;

  try {
    const inputData = new Uint8Array(await blob.arrayBuffer());
    await ffmpeg.writeFile(inputName, inputData);

    // 收集日志输出(ffmpeg -i 解码到 null 时将流信息写入 log)
    const logLines: string[] = [];
    const logHandler = ({ message }: { message: string }) => {
      logLines.push(message);
    };
    ffmpeg.on('log', logHandler);

    try {
      // -f null -:解码输入并丢弃输出,正常情况退出码为 0
      // .catch() 为防御性处理(损坏文件可能非零退出,但 log 中仍有部分信息);
      // FO-07:不再静默,debug 级记录便于排查
      await ffmpeg.exec(['-i', inputName, '-f', 'null', '-']).catch((err) => {
        console.debug('[lokvis:engine-video] getVideoInfo probe exited non-zero:', err);
      });
    } finally {
      ffmpeg.off('log', logHandler);
    }

    const fullLog = logLines.join('\n');

    // 解析 Duration: 00:00:30.52
    let duration = 0;
    const durationMatch = fullLog.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (durationMatch) {
      const hours = Number(durationMatch[1]);
      const minutes = Number(durationMatch[2]);
      const seconds = Number(durationMatch[3]);
      duration = hours * 3600 + minutes * 60 + seconds;
    }

    // 解析视频流:Video: h264 ..., 1920x1080 ..., 30 fps
    let width = 0;
    let height = 0;
    let fps = 0;
    let codec = 'unknown';

    const videoStreamLine = logLines.find((l) => l.includes('Video:'));
    if (videoStreamLine) {
      // 编解码器:Video: h264 (High)
      const codecMatch = videoStreamLine.match(/Video:\s*(\w+)/);
      if (codecMatch) {
        codec = codecMatch[1]!;
      }
      // 分辨率:1920x1080 或 1920x1080 [SAR ...]
      const resMatch = videoStreamLine.match(/(\d{2,5})x(\d{2,5})/);
      if (resMatch) {
        width = Number(resMatch[1]);
        height = Number(resMatch[2]);
      }
      // 帧率:30 fps 或 29.97 fps 或 30 tbr
      const fpsMatch = videoStreamLine.match(/([\d.]+)\s*fps/);
      if (fpsMatch) {
        fps = Number(fpsMatch[1]);
      } else {
        const tbrMatch = videoStreamLine.match(/([\d.]+)\s*tbr/);
        if (tbrMatch) {
          fps = Number(tbrMatch[1]);
        }
      }
    }

    if (!videoStreamLine) {
      throw new Error('getVideoInfo: no video stream found');
    }

    return { width, height, duration, fps, codec };
  } finally {
    await safeDeleteFile(ffmpeg, inputName);
  }
}

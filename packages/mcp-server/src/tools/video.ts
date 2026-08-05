/**
 * Video tools:MCP tool handlers for video processing.
 *
 * 7 个 tool 经 runtime.run(workflow, inputs) 走完整 Capability 系统:
 * - lokvis_video_compress: 压缩视频(video.compress,1→1)
 * - lokvis_video_transcode: 格式转码(video.transcode,1→1)
 * - lokvis_video_trim: 裁剪片段(video.trim,1→1)
 * - lokvis_video_merge: 合并多个视频(video.merge,N→1)
 * - lokvis_video_to_gif: 转为 GIF(video.to-gif,1→1)
 * - lokvis_video_screenshot: 截取帧图片(video.screenshot,1→1)
 * - lokvis_video_extract_audio: 提取音轨(video.extract-audio,1→1)
 *
 * 输入:文件路径(绝对路径或相对 workdir)
 * 输出:处理后的文件路径 + 元数据(大小变化)
 */

import { resolve } from 'node:path';
import type { LokvisRuntime } from '@lokvis/sdk';
import type { McpToolResult } from '../server.js';
import {
  blobToFile,
  makeOutputPath,
  getFileSize,
  formatSize,
} from './fs-helpers.js';
import { runFileTransform } from './workflow-helpers.js';
import {
  videoCompressSchema,
  videoTranscodeSchema,
  videoTrimSchema,
  videoMergeSchema,
  videoToGifSchema,
  videoScreenshotSchema,
  videoExtractAudioSchema,
  validateParams,
} from './schemas.js';
import { GENERATED_TOOL_META } from './tool-metadata.generated.js';
import { requireToolMeta } from './manual-overrides.js';

/** 默认视频 MIME 类型(构造输入 File 时使用) */
const VIDEO_MIME = 'video/mp4';

/**
 * 通用 video transform 流程(FO-18 工厂化)。
 */
function runVideoTransform(
  runtime: LokvisRuntime,
  inputPaths: string[],
  capability: string,
  params: Record<string, unknown>,
  options: { merge: boolean }
): Promise<{ outBlob: Blob }> {
  return runFileTransform({
    runtime,
    inputPaths,
    capability,
    params,
    mime: VIDEO_MIME,
    category: 'video',
    assetType: 'video',
    merge: options.merge,
  });
}

/**
 * lokvis_video_compress:压缩视频文件。
 */
export async function videoCompress(
  params: {
    input_path: string;
    quality?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'compressed', 'mp4');

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = {};
    if (params.quality !== undefined) transformParams.quality = params.quality;

    const { outBlob } = await runVideoTransform(
      runtime,
      [inputPath],
      'video.compress',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    const ratio = ((1 - outBlob.size / originalSize) * 100).toFixed(1);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Video compressed successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Saved: ${ratio}%`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to compress video: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_video_transcode:视频格式转码。
 */
export async function videoTranscode(
  params: {
    input_path: string;
    format: 'mp4' | 'webm' | 'gif';
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'transcoded', params.format, params.format);

  try {
    const originalSize = await getFileSize(inputPath);

    const { outBlob } = await runVideoTransform(
      runtime,
      [inputPath],
      'video.transcode',
      { format: params.format },
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Video transcoded successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Format: ${params.format}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to transcode video: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_video_trim:裁剪视频片段。
 */
export async function videoTrim(
  params: {
    input_path: string;
    start: number;
    end: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'trimmed', 'mp4');

  try {
    const originalSize = await getFileSize(inputPath);

    const { outBlob } = await runVideoTransform(
      runtime,
      [inputPath],
      'video.trim',
      { start: params.start, end: params.end },
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Video trimmed successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Range: ${params.start}s - ${params.end}s`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to trim video: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_video_merge:合并多个视频文件。
 */
export async function videoMerge(
  params: {
    input_paths: string[];
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPaths = params.input_paths;
  if (!Array.isArray(inputPaths) || inputPaths.length < 2) {
    return {
      content: [
        { type: 'text', text: 'Error: input_paths must be an array with at least 2 video files' },
      ],
      isError: true,
    };
  }

  const resolvedPaths = inputPaths.map((p) => resolve(p));
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(resolvedPaths[0]!, 'merged', 'mp4');

  try {
    const inputSizes = await Promise.all(resolvedPaths.map(getFileSize));
    const totalInputSize = inputSizes.reduce((a, b) => a + b, 0);

    const { outBlob } = await runVideoTransform(
      runtime,
      resolvedPaths,
      'video.merge',
      {},
      { merge: true }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Video merged successfully.`,
            `  Inputs: ${resolvedPaths.length} files (${formatSize(totalInputSize)} total)`,
            ...resolvedPaths.map((p, i) => `    - ${p} (${formatSize(inputSizes[i]!)})`),
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to merge videos: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_video_to_gif:将视频转为 GIF。
 */
export async function videoToGif(
  params: {
    input_path: string;
    fps?: number;
    width?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'gif', 'gif', 'gif');

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = {};
    if (params.fps !== undefined) transformParams.fps = params.fps;
    if (params.width !== undefined) transformParams.width = params.width;

    const { outBlob } = await runVideoTransform(
      runtime,
      [inputPath],
      'video.to-gif',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Video converted to GIF successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to convert video to GIF: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_video_screenshot:从视频中截取帧图片。
 */
export async function videoScreenshot(
  params: {
    input_path: string;
    time?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'screenshot', 'png', 'png');

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = {};
    if (params.time !== undefined) transformParams.time = params.time;

    const { outBlob } = await runVideoTransform(
      runtime,
      [inputPath],
      'video.screenshot',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Video screenshot captured successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Time: ${params.time ?? 0}s`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to capture screenshot: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_video_extract_audio:从视频中提取音轨。
 */
export async function videoExtractAudio(
  params: {
    input_path: string;
    format?: 'mp3' | 'wav' | 'aac';
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const audioFormat = params.format ?? 'mp3';
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'audio', audioFormat, audioFormat);

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = { format: audioFormat };

    const { outBlob } = await runVideoTransform(
      runtime,
      [inputPath],
      'video.extract-audio',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Audio extracted from video successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
            `  Format: ${audioFormat}`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to extract audio: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * 注册 Video tools 到 MCP server adapter。
 *
 * 工具描述与 inputSchema 由 codegen 数据驱动（G4）：
 * - description / capability 映射来自 tool-metadata.generated.ts
 *   （capability manifests + @lokvis/data-formats 格式约束）
 * - inputSchema 与描述增强来自 manual-overrides.ts（MCP 特有 input_path/output_path）
 * 本函数仅提供 handler（走 runtime capability 系统）。
 *
 * @param runtime Lokvis Runtime
 */
export function getVideoToolRegistrations(runtime: LokvisRuntime): Array<{
  name: string;
  description: string;
  inputSchema: object;
  handler: (params: Record<string, unknown>) => Promise<McpToolResult>;
}> {
  const reg = (
    toolName: string,
    handler: (params: Record<string, unknown>) => Promise<McpToolResult>,
  ) => {
    const meta = requireToolMeta(GENERATED_TOOL_META, toolName);
    return {
      name: meta.name,
      description: meta.description,
      inputSchema: meta.inputSchema,
      handler,
    };
  };

  return [
    reg('lokvis_video_compress', async (p) => {
      const r = validateParams(videoCompressSchema, p);
      if (!r.success) return r.error;
      return videoCompress(r.data, runtime);
    }),
    reg('lokvis_video_transcode', async (p) => {
      const r = validateParams(videoTranscodeSchema, p);
      if (!r.success) return r.error;
      return videoTranscode(r.data, runtime);
    }),
    reg('lokvis_video_trim', async (p) => {
      const r = validateParams(videoTrimSchema, p);
      if (!r.success) return r.error;
      return videoTrim(r.data, runtime);
    }),
    reg('lokvis_video_merge', async (p) => {
      const r = validateParams(videoMergeSchema, p);
      if (!r.success) return r.error;
      return videoMerge(r.data, runtime);
    }),
    reg('lokvis_video_to_gif', async (p) => {
      const r = validateParams(videoToGifSchema, p);
      if (!r.success) return r.error;
      return videoToGif(r.data, runtime);
    }),
    reg('lokvis_video_screenshot', async (p) => {
      const r = validateParams(videoScreenshotSchema, p);
      if (!r.success) return r.error;
      return videoScreenshot(r.data, runtime);
    }),
    reg('lokvis_video_extract_audio', async (p) => {
      const r = validateParams(videoExtractAudioSchema, p);
      if (!r.success) return r.error;
      return videoExtractAudio(r.data, runtime);
    }),
  ];
}

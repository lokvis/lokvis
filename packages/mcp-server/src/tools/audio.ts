/**
 * Audio tools:MCP tool handlers for audio processing.
 *
 * 4 个 tool 经 runtime.run(workflow, inputs) 走完整 Capability 系统:
 * - lokvis_audio_normalize: 响度标准化(audio.normalize,1→1)
 * - lokvis_audio_transcode: 格式转码(audio.transcode,1→1)
 * - lokvis_audio_trim: 裁剪片段(audio.trim,1→1)
 * - lokvis_audio_merge: 合并多个音频(audio.merge,N→1)
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
  audioNormalizeSchema,
  audioTranscodeSchema,
  audioTrimSchema,
  audioMergeSchema,
  validateParams,
} from './schemas.js';
import { GENERATED_TOOL_META } from './tool-metadata.generated.js';
import { requireToolMeta } from './manual-overrides.js';

/** 默认音频 MIME 类型(构造输入 File 时使用) */
const AUDIO_MIME = 'audio/mpeg';

/**
 * 通用 audio transform 流程(FO-18 工厂化)。
 */
function runAudioTransform(
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
    mime: AUDIO_MIME,
    category: 'audio',
    assetType: 'audio',
    merge: options.merge,
  });
}

/**
 * lokvis_audio_normalize:将音频响度标准化到目标电平。
 */
export async function audioNormalize(
  params: {
    input_path: string;
    level?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'normalized', 'mp3');

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = {};
    if (params.level !== undefined) transformParams.level = params.level;

    const { outBlob } = await runAudioTransform(
      runtime,
      [inputPath],
      'audio.normalize',
      transformParams,
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Audio normalized successfully.`,
            `  Input: ${inputPath} (${formatSize(originalSize)})`,
            `  Output: ${outputPath} (${formatSize(outBlob.size)})`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Failed to normalize audio: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_audio_transcode:音频格式转码。
 */
export async function audioTranscode(
  params: {
    input_path: string;
    format: 'mp3' | 'wav' | 'aac' | 'ogg' | 'flac';
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

    const { outBlob } = await runAudioTransform(
      runtime,
      [inputPath],
      'audio.transcode',
      { format: params.format },
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Audio transcoded successfully.`,
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
        { type: 'text', text: `Failed to transcode audio: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_audio_trim:裁剪音频片段。
 */
export async function audioTrim(
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
    : makeOutputPath(inputPath, 'trimmed', 'mp3');

  try {
    const originalSize = await getFileSize(inputPath);

    const { outBlob } = await runAudioTransform(
      runtime,
      [inputPath],
      'audio.trim',
      { start: params.start, end: params.end },
      { merge: false }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Audio trimmed successfully.`,
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
        { type: 'text', text: `Failed to trim audio: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * lokvis_audio_merge:合并多个音频文件。
 */
export async function audioMerge(
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
        { type: 'text', text: 'Error: input_paths must be an array with at least 2 audio files' },
      ],
      isError: true,
    };
  }

  const resolvedPaths = inputPaths.map((p) => resolve(p));
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(resolvedPaths[0]!, 'merged', 'mp3');

  try {
    const inputSizes = await Promise.all(resolvedPaths.map(getFileSize));
    const totalInputSize = inputSizes.reduce((a, b) => a + b, 0);

    const { outBlob } = await runAudioTransform(
      runtime,
      resolvedPaths,
      'audio.merge',
      {},
      { merge: true }
    );
    await blobToFile(outBlob, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: [
            `Audio merged successfully.`,
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
        { type: 'text', text: `Failed to merge audio files: ${err}` },
      ],
      isError: true,
    };
  }
}

/**
 * 注册 Audio tools 到 MCP server adapter。
 *
 * 工具描述与 inputSchema 由 codegen 数据驱动（G4）：
 * - description / capability 映射来自 tool-metadata.generated.ts
 *   （capability manifests + @lokvis/data-formats 格式约束）
 * - inputSchema 与描述增强来自 manual-overrides.ts（MCP 特有 input_path/output_path）
 * 本函数仅提供 handler（走 runtime capability 系统）。
 *
 * @param runtime Lokvis Runtime
 */
export function getAudioToolRegistrations(runtime: LokvisRuntime): Array<{
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
    reg('lokvis_audio_normalize', async (p) => {
      const r = validateParams(audioNormalizeSchema, p);
      if (!r.success) return r.error;
      return audioNormalize(r.data, runtime);
    }),
    reg('lokvis_audio_transcode', async (p) => {
      const r = validateParams(audioTranscodeSchema, p);
      if (!r.success) return r.error;
      return audioTranscode(r.data, runtime);
    }),
    reg('lokvis_audio_trim', async (p) => {
      const r = validateParams(audioTrimSchema, p);
      if (!r.success) return r.error;
      return audioTrim(r.data, runtime);
    }),
    reg('lokvis_audio_merge', async (p) => {
      const r = validateParams(audioMergeSchema, p);
      if (!r.success) return r.error;
      return audioMerge(r.data, runtime);
    }),
  ];
}

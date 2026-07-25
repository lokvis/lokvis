/**
 * Audio tools:MCP tool handlers for audio processing.
 *
 * 4 个 tool 经 runtime.run(workflow, inputs) 走完整 Capability 系统:
 * - lokvis_audio_compress: 压缩音频(audio.compress,1→1)
 * - lokvis_audio_transcode: 格式转码(audio.transcode,1→1)
 * - lokvis_audio_trim: 裁剪片段(audio.trim,1→1)
 * - lokvis_audio_merge: 合并多个音频(audio.merge,N→1)
 *
 * 注意:audio engine 尚未实装(stub),tools 注册后 runtime.run 会返回
 * "capability not found" 错误。tool handler 结构正确,待 engine 实装后即可工作。
 *
 * 输入:文件路径(绝对路径或相对 workdir)
 * 输出:处理后的文件路径 + 元数据(大小变化)
 */

import { resolve, basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { LokvisRuntime } from '@lokvis/sdk';
import type { McpToolResult } from '../server.js';
import {
  blobToFile,
  makeOutputPath,
  getFileSize,
  formatSize,
} from './fs-helpers.js';
import {
  buildSingleTransformWorkflow,
  buildMergeWorkflow,
} from './workflow-helpers.js';
import {
  audioCompressSchema,
  audioTranscodeSchema,
  audioTrimSchema,
  audioMergeSchema,
  validateParams,
} from './schemas.js';

/** 默认音频 MIME 类型(构造输入 File 时使用) */
const AUDIO_MIME = 'audio/mpeg';

/**
 * 通用 audio transform 流程:file → importAsset → runtime.run → exportAsset → cleanup。
 *
 * 走完整 capability 系统,与 pdf.ts / image.ts / video.ts 模式一致。
 * input/output asset 在流程结束后清理(避免 NodeAssetStore 累积)。
 */
async function runAudioTransform(
  runtime: LokvisRuntime,
  inputPaths: string[],
  capability: string,
  params: Record<string, unknown>,
  options: { merge: boolean }
): Promise<{ outBlob: Blob }> {
  const inputAssetIds: string[] = [];
  for (const p of inputPaths) {
    const buffer = await readFile(p);
    const file = new File([buffer], basename(p), { type: AUDIO_MIME });
    const id = await runtime.importAsset({ kind: 'file', file });
    inputAssetIds.push(id);
  }

  try {
    const workflow = options.merge
      ? buildMergeWorkflow(capability, params, 'audio', 'audio')
      : buildSingleTransformWorkflow(capability, params, 'audio', 'audio');
    const result = await runtime.run(workflow, inputAssetIds);
    if (result.status !== 'completed' || !result.outputs[0]) {
      throw new Error(
        `Workflow ${capability} failed: status=${result.status}` +
          (result.error ? ` error=${result.error}` : '')
      );
    }

    const outAssetId = result.outputs[0];
    const outBlob = await runtime.exportAsset(outAssetId);

    await runtime.removeAsset(outAssetId).catch((e) => {
      console.warn('[mcp-server] cleanup output asset failed:', e);
    });

    return { outBlob };
  } finally {
    for (const id of inputAssetIds) {
      await runtime.removeAsset(id).catch((e) => {
        console.warn('[mcp-server] cleanup input asset failed:', e);
      });
    }
  }
}

/**
 * lokvis_audio_compress:压缩音频文件。
 */
export async function audioCompress(
  params: {
    input_path: string;
    bitrate?: number;
    output_path?: string;
  },
  runtime: LokvisRuntime
): Promise<McpToolResult> {
  const inputPath = resolve(params.input_path);
  const outputPath = params.output_path
    ? resolve(params.output_path)
    : makeOutputPath(inputPath, 'compressed', 'mp3');

  try {
    const originalSize = await getFileSize(inputPath);

    const transformParams: Record<string, unknown> = {};
    if (params.bitrate !== undefined) transformParams.bitrate = params.bitrate;

    const { outBlob } = await runAudioTransform(
      runtime,
      [inputPath],
      'audio.compress',
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
            `Audio compressed successfully.`,
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
        { type: 'text', text: `Failed to compress audio: ${err}` },
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
 * Tool 命名遵循 manifest 约定:`lokvis_${capability.replace(/[-.]/g, '_')}`
 *
 * 注意:audio engine 尚未实装(stub),tools 注册后 runtime.run 会返回
 * "capability not found" 错误。待 engine 实装后即可正常工作。
 *
 * @param runtime Lokvis Runtime
 */
export function getAudioToolRegistrations(runtime: LokvisRuntime): Array<{
  name: string;
  description: string;
  inputSchema: object;
  handler: (params: Record<string, unknown>) => Promise<McpToolResult>;
}> {
  return [
    {
      name: 'lokvis_audio_compress',
      description:
        'Compress an audio file to reduce file size. ' +
        'Optionally specify target bitrate.',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input audio file',
          },
          bitrate: {
            type: 'number',
            description: 'Target bitrate in kbps (optional)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_compressed.mp3)',
          },
        },
        required: ['input_path'],
      },
      handler: async (p) => {
        const r = validateParams(audioCompressSchema, p);
        if (!r.success) return r.error;
        return audioCompress(r.data, runtime);
      },
    },
    {
      name: 'lokvis_audio_transcode',
      description:
        'Transcode an audio file to a different format (mp3, wav, aac, ogg, or flac).',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input audio file',
          },
          format: {
            type: 'string',
            enum: ['mp3', 'wav', 'aac', 'ogg', 'flac'],
            description: 'Target audio format',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional)',
          },
        },
        required: ['input_path', 'format'],
      },
      handler: async (p) => {
        const r = validateParams(audioTranscodeSchema, p);
        if (!r.success) return r.error;
        return audioTranscode(r.data, runtime);
      },
    },
    {
      name: 'lokvis_audio_trim',
      description:
        'Trim an audio file to a specific time range (start/end in seconds).',
      inputSchema: {
        type: 'object',
        properties: {
          input_path: {
            type: 'string',
            description: 'Path to the input audio file',
          },
          start: {
            type: 'number',
            description: 'Start time in seconds',
          },
          end: {
            type: 'number',
            description: 'End time in seconds',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to input_trimmed.mp3)',
          },
        },
        required: ['input_path', 'start', 'end'],
      },
      handler: async (p) => {
        const r = validateParams(audioTrimSchema, p);
        if (!r.success) return r.error;
        return audioTrim(r.data, runtime);
      },
    },
    {
      name: 'lokvis_audio_merge',
      description:
        'Merge multiple audio files into a single audio file. ' +
        'Files are merged in the order specified in input_paths.',
      inputSchema: {
        type: 'object',
        properties: {
          input_paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of paths to audio files to merge (minimum 2)',
          },
          output_path: {
            type: 'string',
            description: 'Path for the output file (optional, defaults to first_input_merged.mp3)',
          },
        },
        required: ['input_paths'],
      },
      handler: async (p) => {
        const r = validateParams(audioMergeSchema, p);
        if (!r.success) return r.error;
        return audioMerge(r.data, runtime);
      },
    },
  ];
}

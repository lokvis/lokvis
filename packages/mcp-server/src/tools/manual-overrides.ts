/**
 * MCP 工具手工覆盖（G4 — mirror C1 platform-manual.ts 模式）。
 *
 * codegen（scripts/codegen-mcp-tools.ts）从 capability manifests + @lokvis/data-formats
 * 生成工具描述（tool-metadata.generated.ts），本文件提供：
 * 1. MCP 特有的 inputSchema（含 input_path / output_path 等 MCP-server 参数，
 *    这些参数不属于 capability manifest，无法自动生成）
 * 2. 可选的描述增强（manifest 描述过于简略时，手工补充对 AI 客户端友好的说明）
 *
 * 合并规则（resolveToolMeta）：
 * - description：override.description > generated.description
 * - inputSchema：override.inputSchema（必须）
 *
 * 铁律：inputSchema 中涉及 capability manifest 参数的枚举值 / 取值范围
 * 必须与 manifest 一致（drift-guard 测试守卫，见 __tests__/tools/schemas.test.ts）。
 */

import type { GeneratedToolMeta } from './tool-metadata.generated.js';

/** 单个工具的手工覆盖 */
export interface McpToolOverride {
  /** 描述增强（优先于 generated description） */
  description?: string;
  /** MCP 协议层 inputSchema（含 input_path / output_path 等 MCP 特有参数） */
  inputSchema: Record<string, unknown>;
}

/** 合并后的工具元数据（供 tool 注册函数消费） */
export interface ResolvedToolMeta {
  name: string;
  capability: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────────────────
// Image overrides
// ──────────────────────────────────────────────────────────────────────────

const IMAGE_OVERRIDES: Record<string, McpToolOverride> = {
  lokvis_image_resize: {
    description:
      'Resize an image to specified dimensions. ' +
      'Supports JPEG, PNG, WebP, AVIF, and GIF formats.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        width: {
          type: 'number',
          description: 'Target width in pixels (optional, scales proportionally if omitted)',
        },
        height: {
          type: 'number',
          description: 'Target height in pixels (optional, scales proportionally if omitted)',
        },
        fit: {
          type: 'string',
          enum: ['cover', 'contain', 'fill', 'inside', 'outside'],
          description: 'Resize strategy (default: cover)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_resized.<ext>)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_image_compress: {
    description:
      'Compress an image to reduce file size. ' +
      'Supports JPEG, PNG, WebP, and AVIF formats.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        quality: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Compression quality 1-100 (default: 80)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_compressed.<ext>)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_image_convert: {
    description:
      'Convert an image to a different format. ' +
      'Target formats: JPEG (lossy, no alpha), PNG (lossless, alpha), ' +
      'WebP (lossy/lossless, alpha), AVIF (lossy/lossless, alpha, HDR).',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        format: {
          type: 'string',
          enum: ['jpeg', 'png', 'webp', 'avif'],
          description: 'Target format',
        },
        quality: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Quality for lossy formats (default: 90)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_converted.<format>)',
        },
      },
      required: ['input_path', 'format'],
    },
  },
  lokvis_image_crop: {
    description:
      'Crop an image to extract a rectangular region. ' +
      'Specify the top-left corner (x, y) and the region size (width, height).',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        x: {
          type: 'number',
          description: 'X coordinate of the top-left corner of the crop region',
        },
        y: {
          type: 'number',
          description: 'Y coordinate of the top-left corner of the crop region',
        },
        width: {
          type: 'number',
          description: 'Width of the crop region in pixels',
        },
        height: {
          type: 'number',
          description: 'Height of the crop region in pixels',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_cropped.<ext>)',
        },
      },
      required: ['input_path', 'x', 'y', 'width', 'height'],
    },
  },
  lokvis_image_watermark: {
    description:
      'Add a watermark to an image (text or image watermark). ' +
      'Supports 9-grid positions and tile mode. ' +
      'Either text or image must be provided.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        text: {
          type: 'string',
          description: 'Watermark text (required if image is not provided)',
        },
        image: {
          type: 'string',
          description: 'Watermark image URL (data URL or http(s) URL; required if text is not provided)',
        },
        position: {
          type: 'string',
          enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'tile'],
          description: 'Watermark position (default: bottom-right)',
        },
        opacity: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Watermark opacity 0-1 (default: 0.8)',
        },
        fontSize: {
          type: 'number',
          description: 'Font size for text watermark (default: 24)',
        },
        color: {
          type: 'string',
          description: 'Color for text watermark (default: #ffffff)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_watermarked.<ext>)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_image_rotate: {
    description:
      'Rotate an image by a specified angle (degrees). ' +
      'Supports arbitrary angles; empty areas are filled with a background color.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        angle: {
          type: 'number',
          description: 'Rotation angle in degrees (e.g. 90, 180, 270, or any value)',
        },
        background: {
          type: 'string',
          description: 'Background color for empty areas (default: #ffffff)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_rotated.<ext>)',
        },
      },
      required: ['input_path', 'angle'],
    },
  },
  lokvis_image_flip: {
    description:
      'Flip (mirror) an image along a specified axis. ' +
      'Supports horizontal, vertical, or both axes.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        axis: {
          type: 'string',
          enum: ['horizontal', 'vertical', 'both'],
          description: 'Flip axis: horizontal (left-right), vertical (top-bottom), or both',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_flipped.<ext>)',
        },
      },
      required: ['input_path', 'axis'],
    },
  },
  lokvis_image_background: {
    description:
      'Replace transparent areas of an image with a solid background color. ' +
      'Useful for converting PNG with transparency to JPEG-ready flat images.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        color: {
          type: 'string',
          description: 'Background color (CSS color string, e.g. #ffffff, rgb(255,0,0))',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_bg.<ext>)',
        },
      },
      required: ['input_path', 'color'],
    },
  },
  lokvis_image_filter: {
    description:
      'Apply a preset filter to an image. ' +
      'Supported filters: grayscale, invert, sepia, blur.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        preset: {
          type: 'string',
          enum: ['grayscale', 'invert', 'sepia', 'blur'],
          description: 'Filter preset to apply',
        },
        radius: {
          type: 'number',
          description: 'Blur radius in pixels (only for blur preset, default: 4)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_filtered.<ext>)',
        },
      },
      required: ['input_path', 'preset'],
    },
  },
  lokvis_image_favicon: {
    description:
      'Generate a multi-size ICO favicon from an image. ' +
      'Non-square inputs are center-cropped to square. ' +
      'Output contains PNG-in-ICO entries for each specified size.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input image file',
        },
        sizes: {
          type: 'array',
          items: { type: 'number' },
          description: 'Target sizes in pixels (default: [16, 32, 48, 256])',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output .ico file (optional, defaults to input_favicon.ico)',
        },
      },
      required: ['input_path'],
    },
  },
};

// ──────────────────────────────────────────────────────────────────────────
// PDF overrides
// ──────────────────────────────────────────────────────────────────────────

const PDF_OVERRIDES: Record<string, McpToolOverride> = {
  lokvis_pdf_merge: {
    description:
      'Merge multiple PDF files into a single PDF. ' +
      'Files are merged in the order specified in input_paths.',
    inputSchema: {
      type: 'object',
      properties: {
        input_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of paths to PDF files to merge (minimum 2)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to first_input_merged.pdf)',
        },
      },
      required: ['input_paths'],
    },
  },
  lokvis_pdf_compress: {
    description:
      'Compress a PDF to reduce file size. ' +
      'Uses object stream compression (level 4-9) for better compression.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input PDF file',
        },
        level: {
          type: 'number',
          minimum: 0,
          maximum: 9,
          description: 'Compression level 0-9 (default: 6; 4+ enables object streams)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_compressed.pdf)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_pdf_split: {
    description:
      'Split a PDF into multiple files. ' +
      'Specify pages_per_file for equal splits or ranges for custom page ranges.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input PDF file',
        },
        pages_per_file: {
          type: 'number',
          description: 'Number of pages per output file (mutually exclusive with ranges)',
        },
        ranges: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
          },
          description: 'Page ranges as [start, end] tuples (1-indexed, inclusive)',
        },
        output_dir: {
          type: 'string',
          description: 'Output directory (optional, defaults to input file directory)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_pdf_rotate: {
    description:
      'Rotate pages in a PDF by 90, 180, or 270 degrees. ' +
      'Optionally specify which pages to rotate.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input PDF file',
        },
        angle: {
          type: 'string',
          enum: ['90', '180', '270'],
          description: 'Rotation angle in degrees',
        },
        pages: {
          type: 'array',
          items: { type: 'number' },
          description: 'Page indices to rotate (0-indexed; optional, defaults to all pages)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_rotated.pdf)',
        },
      },
      required: ['input_path', 'angle'],
    },
  },
  lokvis_pdf_watermark: {
    description:
      'Add a text watermark to all pages of a PDF. ' +
      'Customize opacity, font size, and color.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input PDF file',
        },
        text: {
          type: 'string',
          description: 'Watermark text to add',
        },
        opacity: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Watermark opacity 0-1 (default: 0.3)',
        },
        font_size: {
          type: 'number',
          description: 'Font size for the watermark text (default: 36)',
        },
        color: {
          type: 'string',
          description: 'Watermark color as hex string (default: #888888)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_watermarked.pdf)',
        },
      },
      required: ['input_path', 'text'],
    },
  },
  lokvis_pdf_add_page_numbers: {
    description:
      'Add page numbers to all pages of a PDF. ' +
      'Customize position, format template ({n}/{total}), start number, font size, and color.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input PDF file',
        },
        position: {
          type: 'string',
          enum: ['bottom-center', 'bottom-right', 'top-center', 'top-right'],
          description: 'Page number position (default: bottom-center)',
        },
        format: {
          type: 'string',
          description:
            'Format template with {n} (current page) and {total} placeholders (default: "Page {n} of {total}")',
        },
        start_from: {
          type: 'number',
          minimum: 1,
          description: 'Starting page number (default: 1)',
        },
        font_size: {
          type: 'number',
          description: 'Font size for the page numbers (default: 10)',
        },
        color: {
          type: 'string',
          description: 'Page number color as hex string (default: #666666)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_numbered.pdf)',
        },
      },
      required: ['input_path'],
    },
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Video overrides
// ──────────────────────────────────────────────────────────────────────────

const VIDEO_OVERRIDES: Record<string, McpToolOverride> = {
  lokvis_video_compress: {
    description:
      'Compress a video to reduce file size. ' +
      'Optionally specify quality level.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input video file',
        },
        quality: {
          type: 'number',
          description: 'Quality level (optional, higher = better quality)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_compressed.mp4)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_video_transcode: {
    description:
      'Transcode a video to a different format (mp4, webm, or gif).',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input video file',
        },
        format: {
          type: 'string',
          enum: ['mp4', 'webm', 'gif'],
          description: 'Target format',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional)',
        },
      },
      required: ['input_path', 'format'],
    },
  },
  lokvis_video_trim: {
    description:
      'Trim a video to a specific time range (start/end in seconds).',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input video file',
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
          description: 'Path for the output file (optional, defaults to input_trimmed.mp4)',
        },
      },
      required: ['input_path', 'start', 'end'],
    },
  },
  lokvis_video_merge: {
    description:
      'Merge multiple video files into a single video. ' +
      'Files are merged in the order specified in input_paths.',
    inputSchema: {
      type: 'object',
      properties: {
        input_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of paths to video files to merge (minimum 2)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to first_input_merged.mp4)',
        },
      },
      required: ['input_paths'],
    },
  },
  lokvis_video_to_gif: {
    description:
      'Convert a video to an animated GIF. ' +
      'Optionally specify fps and width for the output.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input video file',
        },
        fps: {
          type: 'number',
          description: 'Frames per second for the GIF (optional)',
        },
        width: {
          type: 'number',
          description: 'Output width in pixels (optional, maintains aspect ratio)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_gif.gif)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_video_screenshot: {
    description:
      'Capture a screenshot (frame) from a video at a specific time.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input video file',
        },
        time: {
          type: 'number',
          description: 'Time in seconds to capture the frame (optional, defaults to 0)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output image file (optional, defaults to input_screenshot.png)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_video_extract_audio: {
    description:
      'Extract the audio track from a video file. ' +
      'Output format can be mp3, wav, or aac.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input video file',
        },
        format: {
          type: 'string',
          enum: ['mp3', 'wav', 'aac'],
          description: 'Audio output format (optional, defaults to mp3)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output audio file (optional)',
        },
      },
      required: ['input_path'],
    },
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Audio overrides
// ──────────────────────────────────────────────────────────────────────────

const AUDIO_OVERRIDES: Record<string, McpToolOverride> = {
  lokvis_audio_normalize: {
    description:
      'Normalize an audio file to a target loudness level (dB). ' +
      'Defaults to -14 LUFS if level is not specified.',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: {
          type: 'string',
          description: 'Path to the input audio file',
        },
        level: {
          type: 'number',
          description: 'Target loudness level in dB (optional, defaults to -14)',
        },
        output_path: {
          type: 'string',
          description: 'Path for the output file (optional, defaults to input_normalized.mp3)',
        },
      },
      required: ['input_path'],
    },
  },
  lokvis_audio_transcode: {
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
  },
  lokvis_audio_trim: {
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
  },
  lokvis_audio_merge: {
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
  },
};

// ──────────────────────────────────────────────────────────────────────────
// AI overrides
// ──────────────────────────────────────────────────────────────────────────

const AI_OVERRIDES: Record<string, McpToolOverride> = {
  lokvis_ai_generate_workflow: {
    description:
      'Generate a Lokvis workflow from a natural language prompt. ' +
      'Returns the generated workflow as JSON. Requires cloud AI configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Natural language description of the desired workflow (e.g. "resize image to 800x600 and convert to webp")',
        },
      },
      required: ['prompt'],
    },
  },
  lokvis_ai_optimize_workflow: {
    description:
      'Optimize an existing Lokvis workflow. ' +
      'Accepts a workflow JSON string and returns an optimized version. ' +
      'Requires cloud AI configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'string',
          description: 'The workflow JSON string to optimize',
        },
      },
      required: ['workflow'],
    },
  },
  lokvis_ai_diagnose_error: {
    description:
      'Diagnose a Lokvis workflow execution error. ' +
      'Accepts an error message and returns a diagnosis report with suggestions. ' +
      'Requires cloud AI configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        error: {
          type: 'string',
          description: 'The error message or stack trace to diagnose',
        },
      },
      required: ['error'],
    },
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 合并
// ──────────────────────────────────────────────────────────────────────────

/** 全部手工覆盖（tool name → override） */
export const MCP_TOOL_OVERRIDES: Record<string, McpToolOverride> = {
  ...IMAGE_OVERRIDES,
  ...PDF_OVERRIDES,
  ...VIDEO_OVERRIDES,
  ...AUDIO_OVERRIDES,
  ...AI_OVERRIDES,
};

/**
 * 合并 generated 元数据与手工覆盖，产出最终工具元数据。
 *
 * - description：override 优先，否则用 generated（manifest + data-formats）
 * - inputSchema：取 override（MCP 特有参数无法自动生成）
 *
 * 未找到 override 的工具返回 null（表示该 capability 尚未在 MCP 层实装）。
 */
export function resolveToolMeta(
  generated: GeneratedToolMeta[],
  toolName: string,
): ResolvedToolMeta | null {
  const gen = generated.find(g => g.name === toolName);
  const override = MCP_TOOL_OVERRIDES[toolName];
  if (!gen || !override) return null;
  return {
    name: gen.name,
    capability: gen.capability,
    description: override.description ?? gen.description,
    inputSchema: override.inputSchema,
  };
}

/** resolveToolMeta 的错误细化版本，用于 reg() 注册时给出明确诊断 */
export function requireToolMeta(
  generated: GeneratedToolMeta[],
  toolName: string,
): ResolvedToolMeta {
  const gen = generated.find(g => g.name === toolName);
  if (!gen) {
    throw new Error(
      `Missing generated metadata for ${toolName} — run "pnpm codegen" to regenerate`
    );
  }
  const override = MCP_TOOL_OVERRIDES[toolName];
  if (!override) {
    throw new Error(
      `Missing manual override for ${toolName} — add inputSchema to manual-overrides.ts`
    );
  }
  return {
    name: gen.name,
    capability: gen.capability,
    description: override.description ?? gen.description,
    inputSchema: override.inputSchema,
  };
}

/**
 * 批量解析某域的工具元数据。
 * 返回按 generated 顺序排列的已解析工具（跳过无 override 的工具）。
 */
export function resolveDomainTools(
  generated: GeneratedToolMeta[],
  toolNames: string[],
): ResolvedToolMeta[] {
  const result: ResolvedToolMeta[] = [];
  for (const name of toolNames) {
    const meta = resolveToolMeta(generated, name);
    if (meta) result.push(meta);
  }
  return result;
}

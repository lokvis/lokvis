/**
 * AI 能力预设
 *
 * 5 个标准 AI 能力声明:generate-workflow / optimize-workflow / caption /
 * ocr / background-remove。
 *
 * 设计原则(见 docs/AI生态冲击调整方案.md §5):
 * - AI 只设计,不执行:generate/optimize-workflow 生成 workflow JSON,由确定性 Runtime 执行
 * - 本地 AI 优先:caption / ocr / background-remove 由 transformers.js 在浏览器内运行
 * - 云端 AI 可选:generate/optimize-workflow 由 cloud-proxy-engine 提供(lokvis-cloud)
 *
 * engine-ai 当前为 stub 实现(version 含 'stub'),CapabilityRegistry 会跳过 stub,
 * 待 transformers.js / cloud-proxy 接入后自动生效。
 */
import type { Capability } from '@lokvis/schema';

export const AI_GENERATE_WORKFLOW: Capability = {
  name: 'ai.generate-workflow',
  description: 'Generate a workflow JSON from a natural language prompt (cloud-proxy)',
  inputTypes: ['data'],
  outputTypes: ['data'],
  params: [
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: 'Natural language description of the desired workflow',
    },
    {
      name: 'contextAssetIds',
      type: 'array',
      items: 'string',
      required: false,
      description: 'Optional context asset IDs to inform generation',
    },
  ],
  performance: 'slow',
  batchable: false,
  mcpExposure: 'public',
};

export const AI_OPTIMIZE_WORKFLOW: Capability = {
  name: 'ai.optimize-workflow',
  description: 'Optimize an existing workflow for performance or quality (cloud-proxy)',
  inputTypes: ['data'],
  outputTypes: ['data'],
  params: [
    {
      name: 'prompt',
      type: 'string',
      required: false,
      description: 'Optimization goal (e.g. "faster", "smaller output")',
    },
  ],
  performance: 'slow',
  batchable: false,
  mcpExposure: 'public',
};

export const AI_CAPTION: Capability = {
  name: 'ai.caption',
  description: 'Generate image caption for accessibility or SEO (transformers.js)',
  inputTypes: ['image'],
  outputTypes: ['text'],
  params: [
    {
      name: 'language',
      type: 'string',
      required: false,
      description: 'Output language code (e.g. "en", "zh")',
    },
    {
      name: 'maxTokens',
      type: 'number',
      required: false,
      min: 1,
      description: 'Maximum tokens for generated caption',
    },
  ],
  performance: 'slow',
  batchable: true,
  mcpExposure: 'public',
};

export const AI_OCR: Capability = {
  name: 'ai.ocr',
  description: 'Recognize text in images or PDFs (transformers.js)',
  inputTypes: ['image', 'pdf'],
  outputTypes: ['text'],
  params: [
    {
      name: 'language',
      type: 'string',
      required: false,
      description: 'OCR language hint (e.g. "eng", "chi_sim")',
    },
    {
      name: 'format',
      type: 'enum',
      values: ['text', 'json', 'structured'],
      default: 'text',
      description: 'Output format: plain text, JSON, or structured blocks',
    },
  ],
  performance: 'slow',
  batchable: true,
  mcpExposure: 'public',
};

export const AI_BACKGROUND_REMOVE: Capability = {
  name: 'ai.background-remove',
  description: 'Remove image background (transformers.js, privacy-first local inference)',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['png', 'webp'],
      default: 'png',
      description: 'Output format (png preserves transparency)',
    },
  ],
  performance: 'slow',
  batchable: true,
  mcpExposure: 'public',
};

/** 所有内置 AI 能力预设 */
export const AI_CAPABILITIES: Capability[] = [
  AI_GENERATE_WORKFLOW,
  AI_OPTIMIZE_WORKFLOW,
  AI_CAPTION,
  AI_OCR,
  AI_BACKGROUND_REMOVE,
];

/**
 * AI 能力预设
 *
 * 5 个 AI 能力声明,对应 engine-ai 的全部 supportedCapabilities:
 * - transformersEngine: ocr / caption / background-remove(本地推理,Blob 输入)
 * - cloudProxyEngine:   generate-workflow / optimize-workflow(云端,无 Blob 输入)
 *
 * 注:ai.generate-workflow 的 inputTypes 为空数组 —— 该能力不接受 Asset 输入,
 * 仅使用 params.prompt 生成 workflow,输出为 data 类型(workflow JSON)。
 */
import type { Capability } from '@lokvis/schema';

export const AI_OCR: Capability = {
  name: 'ai.ocr',
  description: 'Extract text from image or PDF using OCR',
  inputTypes: ['image', 'pdf'],
  outputTypes: ['text'],
  params: [
    { name: 'language', type: 'string', required: false, description: 'OCR language code (e.g. eng, chi)' },
    {
      name: 'format',
      type: 'enum',
      values: ['text', 'json', 'structured'],
      default: 'text',
      description: 'Output format of OCR result',
    },
  ],
  performance: 'slow',
  batchable: true,
};

export const AI_CAPTION: Capability = {
  name: 'ai.caption',
  description: 'Generate a text caption for an image',
  inputTypes: ['image'],
  outputTypes: ['text'],
  params: [
    { name: 'maxTokens', type: 'number', required: false, min: 1, description: 'Max tokens for generated caption' },
    { name: 'language', type: 'string', required: false, description: 'Caption language' },
  ],
  performance: 'slow',
  batchable: true,
};

export const AI_BACKGROUND_REMOVE: Capability = {
  name: 'ai.background-remove',
  description: 'Remove background from image, producing a transparent PNG/WebP',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['png', 'webp'],
      default: 'png',
      description: 'Output image format (transparent)',
    },
  ],
  performance: 'slow',
  batchable: true,
};

export const AI_GENERATE_WORKFLOW: Capability = {
  name: 'ai.generate-workflow',
  description: 'Generate a workflow from a natural-language prompt',
  inputTypes: [],
  outputTypes: ['data'],
  params: [
    { name: 'prompt', type: 'string', required: true, description: 'Natural-language description of the desired workflow' },
    { name: 'contextAssetIds', type: 'array', items: 'string', required: false, description: 'Optional context asset IDs' },
  ],
  performance: 'slow',
  batchable: false,
  mcpExposure: 'public',
};

export const AI_OPTIMIZE_WORKFLOW: Capability = {
  name: 'ai.optimize-workflow',
  description: 'Optimize an existing workflow for performance or cost',
  inputTypes: ['data'],
  outputTypes: ['data'],
  params: [
    { name: 'workflow', type: 'object', required: true, description: 'Workflow definition to optimize' },
  ],
  performance: 'slow',
  batchable: false,
  mcpExposure: 'public',
};

/** 所有内置 AI 能力预设 */
export const AI_CAPABILITIES: Capability[] = [
  AI_OCR,
  AI_CAPTION,
  AI_BACKGROUND_REMOVE,
  AI_GENERATE_WORKFLOW,
  AI_OPTIMIZE_WORKFLOW,
];

/**
 * Developer 工具能力预设
 *
 * 开发者调试与诊断能力:inspect capabilities / inspect asset / validate workflow /
 * profile。对应 Phase 4 的 Developer Workspace,Phase 1 仅提供能力声明。
 */
import type { Capability } from '@lokvis/schema';

export const DEV_INSPECT_CAPABILITIES: Capability = {
  name: 'developer.inspect.capabilities',
  description: 'List all registered capabilities',
  inputTypes: ['data'],
  outputTypes: ['data'],
  params: [],
  performance: 'fast',
  batchable: false,
};

export const DEV_INSPECT_ASSET: Capability = {
  name: 'developer.inspect.asset',
  description: 'Inspect asset metadata and structure',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['data'],
  params: [
    {
      name: 'verbose',
      type: 'boolean',
      default: false,
      description: 'Include full asset detail (tags, history count, timestamps)',
    },
  ],
  performance: 'fast',
  batchable: true,
};

export const DEV_VALIDATE_WORKFLOW: Capability = {
  name: 'developer.validate.workflow',
  description: 'Validate a workflow without executing it',
  inputTypes: ['data'],
  outputTypes: ['data'],
  params: [],
  performance: 'fast',
  batchable: false,
};

export const DEV_PROFILE: Capability = {
  name: 'developer.profile',
  description: 'Profile capability execution time',
  inputTypes: ['image', 'video', 'audio', 'pdf', 'text', 'data'],
  outputTypes: ['data'],
  params: [
    {
      name: 'iterations',
      type: 'number',
      default: 1,
      min: 1,
      description: 'Number of profiling iterations per input asset',
    },
  ],
  performance: 'slow',
  batchable: true,
};

/** 所有内置 Developer 工具能力预设 */
export const DEVELOPER_CAPABILITIES: Capability[] = [
  DEV_INSPECT_CAPABILITIES,
  DEV_INSPECT_ASSET,
  DEV_VALIDATE_WORKFLOW,
  DEV_PROFILE,
];

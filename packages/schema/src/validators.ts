/**
 * Lokvis Schema Zod Validators
 *
 * 提供 Workflow / Asset / Plugin 的运行时校验。
 */

import { z } from 'zod';

export const assetTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'pdf',
  'text',
  'data',
  'unknown',
]);

export const assetMetadataSchema = z.object({
  mimeType: z.string(),
  size: z.number().nonnegative(),
  dimensions: z
    .object({ width: z.number().positive(), height: z.number().positive() })
    .optional(),
  duration: z.number().nonnegative().optional(),
  pages: z.number().int().positive().optional(),
  format: z.string(),
});

export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['load', 'transform', 'export']),
  // capability 仅 transform 节点必填;load/export 可不填
  capability: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  label: z.string().optional(),
}).refine(
  (node) => node.type !== 'transform' || (typeof node.capability === 'string' && node.capability.length > 0),
  { message: 'transform 节点必须指定 capability' }
);

export const workflowEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const workflowSchema = z.object({
  $schema: z.string().optional(),
  id: z.string(),
  version: z.string(),
  name: z.string(),
  description: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  category: z.string(),
  tags: z.array(z.string()),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  inputs: z.object({
    type: assetTypeSchema,
    multiple: z.boolean(),
    maxCount: z.number().int().positive().optional(),
    accept: z.array(z.string()).optional(),
  }),
  outputs: z.object({
    type: z.enum(['image', 'video', 'audio', 'pdf', 'text', 'data', 'unknown', 'archive']),
    format: z.string().optional(),
  }),
  official: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const pluginManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  license: z.string(),
  main: z.string(),
  icon: z.string().optional(),
  capabilities: z.array(z.string()),
  engines: z.object({ 'lokvis-runtime': z.string() }),
  permissions: z.array(z.string()),
});

/** 校验 Workflow JSON */
export function validateWorkflow(data: unknown) {
  return workflowSchema.safeParse(data);
}

/** 校验 Plugin Manifest */
export function validatePluginManifest(data: unknown) {
  return pluginManifestSchema.safeParse(data);
}

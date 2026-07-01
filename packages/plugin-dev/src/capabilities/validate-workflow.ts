/**
 * developer.validate.workflow —— 校验 Workflow 定义(不执行)
 *
 * Workflow 通过 params.workflow 传入,返回 valid/errors/nodeCount/edgeCount。
 */
import type { CapabilityImplementation, PluginContext, Workflow } from '@lokvis/schema';
import { createCapabilityImpl } from '@lokvis/plugin-sdk';
import { createJsonAsset, INLINE_ENGINE } from './shared.js';

/** 创建 developer.validate.workflow 能力实现 */
export function createValidateWorkflowImpl(
  ctx: PluginContext
): CapabilityImplementation {
  return createCapabilityImpl(
    'developer.validate.workflow',
    INLINE_ENGINE,
    async (_inputs, params, execCtx) => {
      const workflow = params.workflow as Workflow | undefined;
      const errors: string[] = [];

      if (!workflow || typeof workflow !== 'object') {
        errors.push('Missing "workflow" parameter');
      } else {
        if (!workflow.id) errors.push('Workflow "id" is required');
        if (!workflow.name) errors.push('Workflow "name" is required');

        // 节点校验：必须为数组且至少一个节点，每个节点需有 id 与 capability
        const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
        const edges = Array.isArray(workflow.edges) ? workflow.edges : [];

        if (nodes.length === 0) {
          errors.push('Workflow must contain at least one node');
        }
        for (const node of nodes) {
          if (!node.id) errors.push('Node missing "id"');
          if (!node.capability) {
            errors.push(`Node "${node.id || '?'}" missing "capability"`);
          }
        }

        // 边校验：from / to 必须引用已存在的节点
        const nodeIds = new Set(nodes.map((n) => n.id));
        for (const edge of edges) {
          if (!nodeIds.has(edge.from)) {
            errors.push(`Edge references unknown "from" node: ${edge.from}`);
          }
          if (!nodeIds.has(edge.to)) {
            errors.push(`Edge references unknown "to" node: ${edge.to}`);
          }
        }
      }

      execCtx.onProgress?.(1, 'Validation complete');
      return [
        await createJsonAsset(ctx, {
          valid: errors.length === 0,
          errors,
          nodeCount: Array.isArray(workflow?.nodes) ? workflow.nodes.length : 0,
          edgeCount: Array.isArray(workflow?.edges) ? workflow.edges.length : 0,
        }),
      ];
    }
  );
}

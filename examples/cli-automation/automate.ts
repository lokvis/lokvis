/**
 * CLI 自动化示例
 *
 * 演示如何在 Node.js 脚本中编程式调用 @lokvis/cli：
 * 1. 列出内置能力（runCLI(['capabilities'])）
 * 2. 构造一个 Workflow 并做结构校验
 *
 * 限制说明：Lokvis Runtime 设计为浏览器优先，图像能力
 * （resize / compress / convert 等）依赖 Canvas 与 createImageBitmap，
 * 在 Node.js 中不可用。因此 `runCLI(['run', ...])` 在 Node 中只能
 * 执行不依赖浏览器 API 的能力（如 asset.rename）。
 * 本脚本只做能力查询与工作流校验，不实际执行图像处理。
 */
import { runCLI } from '@lokvis/cli';
import type { Workflow } from '@lokvis/schema';

/** 演示用的工作流定义 */
const sampleWorkflow: Workflow = {
  id: 'ci-resize-workflow',
  version: '1.0.0',
  name: 'CI Resize',
  description: 'A sample workflow used to validate schema in CI.',
  author: { id: 'ci', name: 'CLI Automation' },
  category: 'image',
  tags: ['resize', 'ci'],
  nodes: [
    { id: 'n-load', type: 'load', capability: 'asset.load' },
    {
      id: 'n-resize',
      type: 'transform',
      capability: 'image.resize',
      params: { width: 1280, height: 720, fit: 'cover' },
      label: 'Resize',
    },
    { id: 'n-export', type: 'export', capability: 'asset.export' },
  ],
  edges: [
    { from: 'n-load', to: 'n-resize' },
    { from: 'n-resize', to: 'n-export' },
  ],
  inputs: { type: 'image', multiple: false, accept: ['image/*'] },
  outputs: { type: 'image', format: 'png' },
};

/**
 * 与 @lokvis/cli 内部 validateWorkflow 一致的结构校验。
 * 在 CI 中可用此函数在「不执行」的前提下检查工作流 JSON 是否合法。
 */
function validateWorkflow(wf: unknown): { ok: boolean; error?: string } {
  if (typeof wf !== 'object' || wf === null) {
    return { ok: false, error: 'Workflow must be an object' };
  }
  const w = wf as Record<string, unknown>;
  if (typeof w.id !== 'string') return { ok: false, error: 'Workflow.id must be string' };
  if (typeof w.name !== 'string') return { ok: false, error: 'Workflow.name must be string' };
  if (!Array.isArray(w.nodes)) return { ok: false, error: 'Workflow.nodes must be array' };
  if (!Array.isArray(w.edges)) return { ok: false, error: 'Workflow.edges must be array' };
  for (const node of w.nodes as Array<Record<string, unknown>>) {
    if (typeof node.id !== 'string' || typeof node.capability !== 'string') {
      return { ok: false, error: 'Each node must have id and capability' };
    }
  }
  return { ok: true };
}

async function main(): Promise<void> {
  console.log('=== 1. 列出内置能力（runCLI capabilities） ===');
  // runCLI 直接写入 process.stdout，这里复用同一入口
  await runCLI(['capabilities']);
  console.log();

  console.log('=== 2. 校验工作流结构 ===');
  const result = validateWorkflow(sampleWorkflow);
  if (result.ok) {
    console.log(`✓ Workflow "${sampleWorkflow.id}" 校验通过`);
  } else {
    console.error(`✗ 校验失败：${result.error}`);
    process.exitCode = 1;
    return;
  }
  console.log();

  console.log('=== 3. 关于在 Node 中运行工作流 ===');
  // 若尝试 runCLI(['run', './workflow.json', './input.png'])，CLI 会：
  //   - 校验工作流 JSON 结构（通过）
  //   - 调用 runtime.run() 执行
  //   - engine-image 需要 Canvas / createImageBitmap → 在 Node 中抛错
  // 因此 CI 场景建议仅用于：能力查询、工作流校验，
  // 或 asset.rename 这类不依赖浏览器 API 的能力。
  console.log('图像能力（image.resize 等）依赖浏览器 Canvas，无法在 Node 中执行。');
  console.log('CI 中建议仅做能力查询与工作流校验。');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

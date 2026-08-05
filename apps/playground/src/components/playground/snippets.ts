/**
 * Playground 示例代码片段(W19.6)
 *
 * 在 toolbar 通过 dropdown 选择,一键填充编辑器。
 * 每个 snippet 是自包含、可独立运行的 IIFE async 代码,
 * 由 Playground.tsx 的 new Function 沙箱执行,
 * 可访问注入参数:createLokvis / imageToolsPlugin / devToolsPlugin / lokvis。
 *
 * 注意:
 *  - 代码中 `lokvis` 是已就绪的 Runtime 实例(Playground 启动时已 createLokvis);
 *  - `imageToolsPlugin` / `devToolsPlugin` 是工厂函数,需 `imageToolsPlugin()` 调用;
 *  - 用户也可另起 `createLokvis()` 创建独立实例(用于演示工厂用法)。
 */

// FO-05:限额文案引用 @lokvis/schema 单一事实源,不再硬编码数字
import { FREE_BATCH_LIMIT, FREE_CONCURRENCY, PRO_CONCURRENCY } from '@lokvis/schema';

export interface Snippet {
  /** 唯一 id,用作 select value 与 localStorage snippetId */
  id: string;
  /** 显示名(英文) */
  labelEn: string;
  /** 显示名(中文) */
  labelZh: string;
  /** 简短描述(英文) */
  descEn: string;
  /** 简短描述(中文) */
  descZh: string;
  /** 代码内容(不带外层 IIFE,Playground 会自动包裹) */
  code: string;
}

export const SNIPPETS: readonly Snippet[] = [
  {
    id: 'hello',
    labelEn: 'Hello SDK',
    labelZh: 'Hello SDK',
    descEn: 'List registered capabilities',
    descZh: '列出已注册的能力',
    code: `// Hello @lokvis/sdk
// \`lokvis\` is a ready Runtime injected by the playground.

const caps = await lokvis.capabilities();
console.log('Registered capabilities:', caps.length);

caps.forEach((c) => console.log('  -', c.name));
`,
  },
  {
    id: 'resize',
    labelEn: 'Resize an uploaded image',
    labelZh: '缩放上传的图片',
    descEn: 'importAsset → run workflow → exportAsset',
    descZh: '导入 → 执行工作流 → 导出',
    code: `// Resize an uploaded image to width=400.
// Uses the injected \`lokvis\` runtime.

const file = await new Promise<File>((resolve) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => resolve(input.files?.[0] ?? null);
  input.click();
});

if (!file) {
  console.log('No file selected, abort.');
  return;
}

const assetId = await lokvis.importAsset({ kind: 'file', file });
console.log('Imported asset:', assetId);

const result = await lokvis.run(
  {
    id: 'demo-resize',
    version: '1.0',
    name: 'Resize',
    author: { id: 'playground', name: 'Playground' },
    category: 'image',
    nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize', params: { width: 400, height: 0, fit: 'inside' } }],
    edges: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  },
  [assetId],
);

console.log('Workflow status:', result.status, '·', result.duration, 'ms');
if (result.status === 'completed' && result.outputs.length > 0) {
  const blob = await lokvis.exportAsset(result.outputs[0]);
  console.log('Output blob:', blob.type, Math.round(blob.size / 1024), 'KB');

  // Trigger a download so the user can inspect the result
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`lokvis-resized-\${Date.now()}.png\`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
`,
  },
  {
    id: 'eventbus',
    labelEn: 'Watch runtime events',
    labelZh: '监听 runtime 事件',
    descEn: 'eventBus.onAny + run a workflow',
    descZh: 'eventBus.onAny + 执行工作流',
    code: `// Subscribe to runtime events and run a small workflow.
// Events are also surfaced in the Output panel as [event] entries.

const unsub = lokvis.eventBus.onAny((e) => {
  console.log('[event]', e.type, e.payload ?? '');
});

console.log('Subscribed. Now running a workflow to generate events...');

const caps = await lokvis.capabilities();
console.log('Capabilities:', caps.length);

// Unsubscribe after 5 seconds so the playground output stays clean
setTimeout(() => {
  unsub();
  console.log('Unsubscribed.');
}, 5000);
`,
  },
  {
    id: 'factory',
    labelEn: 'createLokvis() factory',
    labelZh: 'createLokvis() 工厂',
    descEn: 'Spin up an independent runtime instance',
    descZh: '启动一个独立的 runtime 实例',
    code: `// Demonstrate the createLokvis() factory independently.
// This creates a separate runtime from the playground's injected \`lokvis\`.

const rt = await createLokvis({
  plugins: [imageToolsPlugin(), devToolsPlugin()],
});

console.log('New runtime created.');
console.log('Same as injected?', rt === lokvis ? 'yes' : 'no (separate instance)');

const caps = await rt.capabilities();
console.log('Capabilities:', caps.length);

// Inspect the MCP manifest — useful when wiring up an MCP client
const manifest = await rt.toMcpManifest();
console.log('MCP tools:', manifest.tools.length);
manifest.tools.slice(0, 3).forEach((t) => console.log('  -', t.name));
`,
  },
  {
    id: 'batch',
    labelEn: 'Batch processor',
    labelZh: '批量处理器',
    descEn: 'BatchProcessor enqueue + onProgress',
    descZh: '入队 + 进度回调',
    code: `// Use the BatchProcessor for concurrent jobs.
// Free tier limits: ${FREE_BATCH_LIMIT} files / ${FREE_CONCURRENCY} concurrency (Pro: unlimited / ${PRO_CONCURRENCY}).

const batch = lokvis.batch;

console.log('Batch processor ready.');
console.log('Jobs:', batch.list());

// Note: real enqueue requires BatchItemInput[] — see "Resize an uploaded image" snippet
// for an end-to-end example. Here we only inspect the processor.

console.log('Free limits: ${FREE_BATCH_LIMIT} files / ${FREE_CONCURRENCY} concurrency.');
`,
  },
] as const;

/** 默认 snippet id(Playground 首次启动时使用) */
export const DEFAULT_SNIPPET_ID = 'hello';

/** snippet id → snippet 查找;找不到返回 DEFAULT */
export function findSnippet(id: string | null | undefined): Snippet {
  if (!id) return SNIPPETS[0]!;
  return SNIPPETS.find((s) => s.id === id) ?? SNIPPETS[0]!;
}

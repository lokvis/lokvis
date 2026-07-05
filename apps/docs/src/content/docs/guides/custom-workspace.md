---
title: Build a Custom Workspace
description: Drive @lokvis/sdk directly without using @lokvis/ui-react.
draft: false
head: []
---

# Build a Custom Workspace

`<Workspace />` from `@lokvis/ui-react` is convenient, but sometimes you need full control over the UI — a different layout, a non-React framework, or a deeply embedded tool panel inside your existing app. This guide shows how to build a minimal image workspace using only `@lokvis/sdk` and `@lokvis/plugin-image`.

> The complete source for this guide lives in [`examples/custom-workspace/`](https://github.com/lokvis/lokvis/tree/dev/examples/custom-workspace).

## What you will build

A single-page workspace that:

1. Lets the user pick a local image file
2. Imports it as a Lokvis `Asset`
3. Runs an `image.resize` workflow on it
4. Previews the resized result
5. Handles Lokvis errors with the typed error hierarchy

No `@lokvis/ui-react`, no Astro — just TypeScript + a tiny HTML page.

## 1. Page structure

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Custom Lokvis Workspace</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 24px; }
      .row { display: flex; gap: 24px; align-items: flex-start; }
      .col { display: flex; flex-direction: column; gap: 8px; }
      .preview { max-width: 320px; max-height: 240px; border: 1px solid #ccc; }
      #status { color: #555; min-height: 1.5em; }
      #status.error { color: #c00; }
    </style>
  </head>
  <body>
    <h1>Custom Workspace</h1>
    <div class="col">
      <input id="file-input" type="file" accept="image/*" />
      <div class="row">
        <label>Width <input id="width" type="number" value="800" /></label>
        <label>Height <input id="height" type="number" value="600" /></label>
        <button id="resize-btn" disabled>Resize</button>
      </div>
      <p id="status">Idle.</p>
      <div class="row">
        <div class="col">
          <strong>Original</strong>
          <img id="original-preview" class="preview" hidden />
        </div>
        <div class="col">
          <strong>Result</strong>
          <img id="result-preview" class="preview" hidden />
        </div>
      </div>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

> Browsers cannot load `.ts` files directly. Use Vite (`npx vite examples/custom-workspace`) or any dev server that transpiles TypeScript on the fly.

## 2. Initialize the Runtime

`createLokvis()` returns a `LokvisRuntime` instance. Pass the plugins you want to preload — here, just the image tools.

```typescript
// main.ts
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import type { LokvisRuntime } from '@lokvis/runtime';

let runtime: LokvisRuntime;
let inputAssetId: string | null = null;

async function init(): Promise<void> {
  runtime = await createLokvis({
    plugins: [imageToolsPlugin()],
  });
  setStatus('Runtime ready.');
}
```

## 3. Import the user-selected file

`importAsset()` accepts a tagged-union `AssetSource`. The `{ kind: 'file', file }` variant reads a `File` (or `Blob`) and persists it to OPFS / IndexedDB / memory automatically.

```typescript
async function onFileChange(): Promise<void> {
  const file = fileInput.files?.[0];
  if (!file) return;

  originalPreview.src = URL.createObjectURL(file);
  originalPreview.hidden = false;
  resultPreview.hidden = true;

  setStatus('Importing…');
  inputAssetId = await runtime.importAsset({ kind: 'file', file });
  resizeBtn.disabled = false;
  setStatus(`Imported asset: ${inputAssetId}`);
}
```

## 4. Build a linear workflow

A `Workflow` is a directed acyclic graph. In Year 1 only **linear** workflows are supported (max 5 transform nodes). The structure is: `load` → 0..N `transform` → `export`. The Runtime skips `load` / `export` nodes (they are markers) and only executes `transform` nodes.

```typescript
import type { Workflow } from '@lokvis/schema';

function buildResizeWorkflow(width: number, height: number): Workflow {
  return {
    id: 'custom-resize-workflow',
    version: '1.0.0',
    name: 'Custom Resize',
    description: 'Resize an image to a fixed dimension.',
    author: { id: 'example', name: 'Custom Workspace Example' },
    category: 'image',
    tags: ['resize', 'example'],
    nodes: [
      { id: 'n-load', type: 'load', capability: 'asset.load' },
      {
        id: 'n-resize',
        type: 'transform',
        capability: 'image.resize',
        params: { width, height, fit: 'cover', maintainAspectRatio: true },
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
}
```

## 5. Run, export, and preview

`runtime.run()` accepts `AssetId[]` or `Asset[]` and returns a `WorkflowResult`. Call `exportAsset()` to materialize the output as a `Blob` for preview or download.

```typescript
async function onResize(): Promise<void> {
  if (!inputAssetId) return;
  resizeBtn.disabled = true;
  setStatus('Running workflow…');

  try {
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    const workflow = buildResizeWorkflow(width, height);

    const result = await runtime.run(workflow, [inputAssetId]);
    if (result.status !== 'completed' || result.outputs.length === 0) {
      throw new Error(result.error || `Workflow ${result.status}`);
    }

    const blob = await runtime.exportAsset(result.outputs[0]!);
    resultPreview.src = URL.createObjectURL(blob);
    resultPreview.hidden = false;
    setStatus(`Done in ${result.duration}ms.`);
  } catch (err) {
    // 见下一节:用 LokvisError 体系归一错误
  } finally {
    resizeBtn.disabled = false;
  }
}
```

## 6. Handle errors with the Lokvis hierarchy

All SDK errors extend `LokvisError` and carry a stable `code` field. Use `fromLokvisError()` to normalize any thrown value — it always returns a `LokvisError` (mapping non-Lokvis values to `code: 'UNKNOWN'`), so there is no need for an `instanceof LokvisError` guard.

```typescript
import {
  DegradationRejectedError,
  fromLokvisError,
} from '@lokvis/sdk';

// (inside the catch block above)
const lokvisErr = fromLokvisError(err);

if (lokvisErr instanceof DegradationRejectedError) {
  // DegradationRejectedError 携带 guide 数组(用户可读建议),
  // 是 LokvisError 子类,先判断以访问 guide 字段。
  setStatus(`图片过大被拒绝:${lokvisErr.guide[0] ?? ''}`, true);
} else {
  switch (lokvisErr.code) {
    case 'STORAGE_QUOTA_EXCEEDED': {
      // context.usage 是 unknown,需类型守卫后用于模板字符串
      const usage = lokvisErr.context?.usage;
      const usageStr = typeof usage === 'number' ? String(usage) : '?';
      setStatus(`存储已满(已用 ${usageStr} 字节),请清理资产后重试`, true);
      break;
    }
    default:
      setStatus(`[${lokvisErr.code}] ${lokvisErr.message}`, true);
  }
}
```

Common codes you will hit:

| Code | Cause |
|------|-------|
| `STORAGE_QUOTA_EXCEEDED` | OPFS/IDB 配额满,清理资产或调高 `storageQuota` |
| `DEGRADATION_REJECTED` | 输入图过大且不可降级,`guide` 字段含用户建议 |
| `CAPABILITY_NOT_REGISTERED` | 未加载对应 plugin |
| `WORKFLOW_INVALID` | 工作流 JSON 结构校验失败 |

See the [SDK reference](../sdk#error-handling) for the full list.

## 7. Wire up event listeners and start

```typescript
fileInput.addEventListener('change', onFileChange);
resizeBtn.addEventListener('click', onResize);

void init();
```

## Run it

From the monorepo root:

```bash
pnpm build                              # 1. Build all @lokvis/* packages
npx vite examples/custom-workspace      # 2. Serve the example
# → http://localhost:5173
```

## When to choose custom over `<Workspace />`

| Need | Use `<Workspace />` | Use custom |
|------|---------------------|------------|
| Drop-in image tooling | ✅ | |
| Match your existing app's design system | | ✅ |
| Non-React framework (Vue/Svelte/vanilla) | | ✅ |
| Run workflows headlessly (no UI) | | ✅ (or [CLI automation](./cli-automation)) |
| Need the full inspector / history / compare UI | ✅ | |

If you only need headless workflow execution, the [CLI automation](./cli-automation) guide covers a Node.js path with no UI at all.

## Next steps

- [Embed the SDK](./embed-sdk) — the faster path with `<Workspace />`
- [CLI Automation](./cli-automation) — drive Lokvis from a Node.js script
- [SDK reference](../sdk) — full Runtime API and error codes

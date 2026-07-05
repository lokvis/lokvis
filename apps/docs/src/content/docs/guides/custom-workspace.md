---
title: Build a Custom Workspace
description: Build a minimal image workbench using only @lokvis/sdk + @lokvis/plugin-image (no @lokvis/ui-react) — import, resize, run, export, and handle LokvisError.
draft: false
head: []
---

# Build a Custom Workspace

This guide builds a minimal image workbench in plain HTML + TypeScript using only `@lokvis/sdk` and `@lokvis/plugin-image`. No React, no `<Workspace />` — just the Runtime API. You will import a file, build a resize workflow, run it, export the result, and handle every `LokvisError` code path.

## When to skip `<Workspace />`

| Dimension | `<Workspace />` (full UI) | Custom workspace (Runtime only) |
|---|---|---|
| Bundle size | ~200 KB JS + React 19 | ~80 KB JS (Runtime + engine-image) |
| Use case | Image tools for end users | Embed in a non-React stack (Vue/Svelte/vanilla), CI scripts, demos |
| Customization | `enable*` props | Total — you own the DOM |
| Boilerplate | ~10 lines | ~150 lines (file input, preview, status, error handling) |
| History / undo | Built-in `HistoryPanel` | You implement via `runtime.undo()` / `redo()` |
| Workflow editor | Built-in `WorkflowEditor` | You build the UI |

Choose `<Workspace />` if you want a fully-featured image tool out of the box. Choose a custom workspace if you need a smaller bundle, a non-React host, or a tightly constrained single-purpose tool.

## 1. HTML

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <body>
    <h1>Custom Resize</h1>
    <input type="file" id="file-input" accept="image/*" />
    <label>Width <input type="number" id="width" value="1280" /></label>
    <label>Height <input type="number" id="height" value="720" /></label>
    <button id="resize-btn" disabled>Resize</button>
    <p id="status"></p>
    <div style="display:flex;gap:16px">
      <img id="original-preview" hidden alt="original" />
      <img id="result-preview" hidden alt="result" />
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

## 2. Initialize the Runtime

```ts
// main.ts
import { createLokvis, DegradationRejectedError, fromLokvisError } from '@lokvis/sdk';
import type { LokvisRuntime } from '@lokvis/runtime';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import type { Workflow } from '@lokvis/schema';

const fileInput = document.getElementById('file-input') as HTMLInputElement;
const widthInput = document.getElementById('width') as HTMLInputElement;
const heightInput = document.getElementById('height') as HTMLInputElement;
const resizeBtn = document.getElementById('resize-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const originalPreview = document.getElementById('original-preview') as HTMLImageElement;
const resultPreview = document.getElementById('result-preview') as HTMLImageElement;

let runtime: LokvisRuntime;
let inputAssetId: string | null = null;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function init(): Promise<void> {
  runtime = await createLokvis({
    plugins: [imageToolsPlugin()],
  });
  setStatus('Runtime ready.');
}
```

## 3. `importAsset()` → `buildResizeWorkflow()` → `run()` → `exportAsset()`

```ts
async function onFileChange(): Promise<void> {
  const file = fileInput.files?.[0];
  if (!file) return;

  originalPreview.src = URL.createObjectURL(file);
  originalPreview.hidden = false;
  resultPreview.hidden = true;

  setStatus('Importing…');
  // Step 1: import the file as a Lokvis Asset
  inputAssetId = await runtime.importAsset({ kind: 'file', file });
  resizeBtn.disabled = false;
  setStatus(`Imported asset: ${inputAssetId}`);
}

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

async function onResize(): Promise<void> {
  if (!inputAssetId) return;
  resizeBtn.disabled = true;
  setStatus('Running workflow…');

  try {
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    const workflow = buildResizeWorkflow(width, height);

    // Step 2 + 3: run the workflow with the input asset
    const result = await runtime.run(workflow, [inputAssetId]);
    if (result.status !== 'completed' || result.outputs.length === 0) {
      throw new Error(result.error || `Workflow ${result.status}`);
    }

    // Step 4: export the output asset back to a Blob
    const blob = await runtime.exportAsset(result.outputs[0]!);
    resultPreview.src = URL.createObjectURL(blob);
    resultPreview.hidden = false;
    setStatus(`Done in ${result.duration}ms.`);
  } catch (err) {
    handleLokvisError(err);
  } finally {
    resizeBtn.disabled = false;
  }
}

fileInput.addEventListener('change', onFileChange);
resizeBtn.addEventListener('click', onResize);

void init();
```

## 4. Error handling with `fromLokvisError()` + `DegradationRejectedError` + `STORAGE_QUOTA_EXCEEDED`

`fromLokvisError(value: unknown)` normalizes any thrown value into a `LokvisError` instance, so you only need one `catch` block. It:

1. Returns the value unchanged if it is already a `LokvisError`.
2. Wraps known runtime error subclasses (`QuotaExceededError`, `DegradationRejectedError`, `WorkerCrashedError`, etc.) into the SDK equivalents using `instanceof`.
3. Falls back to message-pattern matching for legacy `throw new Error(...)` call sites.
4. Returns an `UNKNOWN` `LokvisError` as a last resort, preserving `cause`.

```ts
function handleLokvisError(err: unknown): void {
  // fromLokvisError() always returns a LokvisError — no `instanceof LokvisError` guard needed.
  const lokvisErr = fromLokvisError(err);

  // DegradationRejectedError is a LokvisError subclass — narrow with instanceof
  // to access the .guide field (user-readable recovery suggestions).
  if (lokvisErr instanceof DegradationRejectedError) {
    setStatus(`Image too large, rejected: ${lokvisErr.guide[0] ?? ''}`, true);
    return;
  }

  switch (lokvisErr.code) {
    case 'STORAGE_QUOTA_EXCEEDED': {
      // context is unknown-typed; narrow before using as a number
      const usage = lokvisErr.context?.usage;
      const usageStr = typeof usage === 'number' ? String(usage) : '?';
      setStatus(`Storage full (${usageStr} bytes used). Remove old assets and retry.`, true);
      break;
    }
    case 'CAPABILITY_NOT_REGISTERED':
      setStatus(`Capability missing — did you load @lokvis/plugin-image?`, true);
      break;
    case 'WORKER_CRASHED':
    case 'WORKER_DEAD':
      setStatus(`Worker died. Try a smaller image or fewer tabs.`, true);
      break;
    case 'WORKFLOW_INVALID':
      setStatus(`Workflow rejected: ${lokvisErr.message}`, true);
      break;
    default:
      setStatus(`[${lokvisErr.code}] ${lokvisErr.message}`, true);
  }
}
```

### The error normalization ladder

| Layer | What it throws | How `fromLokvisError` matches |
|---|---|---|
| Engine (Worker) | `DOMException('AbortError')` | message pattern → `WORKER_REQUEST_ABORTED` |
| Runtime (memory) | `DegradationRejectedError` | `instanceof` → `DEGRADATION_REJECTED` (with `.guide`) |
| Runtime (storage) | `QuotaExceededError` | `instanceof` → `STORAGE_QUOTA_EXCEEDED` (with `usage`/`delta`/`quota`) |
| Runtime (worker) | `WorkerCrashedError`, `WorkerDeadError`, `WorkerHandshakeError`, … | `instanceof` → matching `WORKER_*` code |
| Executor | `Error('No implementation registered for capability "…"')` | message pattern → `CAPABILITY_NOT_REGISTERED` |
| SDK | `PluginLoadError`, `AssetNotFoundError`, … | already `LokvisError` subclasses — returned as-is |

`LokvisError.code` is the **stable contract** for programmatic branching. Class names may change across versions; the code will not.

## 5. Run it

Install the dependencies and run with Vite (or any bundler that handles `crypto.randomUUID` and `OffscreenCanvas`):

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image
pnpm add -D vite typescript
pnpm vite
```

## Comparison: custom vs `<Workspace />`

| Feature | Custom (this guide) | `<Workspace />` |
|---|---|---|
| Imports | `@lokvis/sdk` + `@lokvis/plugin-image` | `+ @lokvis/ui-react` |
| Total LOC | ~150 | ~10 |
| File picker | You build it | `<GlobalDropzone />` |
| Workflow editor | None | `<WorkflowEditor />` (drag-and-drop) |
| History panel | None (or call `runtime.undo()`) | `<HistoryPanel />` (cursor + jump) |
| Compare slider | None | `<CompareSlider />` |
| Error banner | `handleLokvisError()` | `<ErrorBanner />` (renders code + message) |
| Storage meter | `runtime.getStorageUsage()` | `<StatusBar />` (auto-refreshed) |
| Bundle | ~80 KB | ~200 KB + React 19 |

If you find yourself rebuilding `HistoryPanel`, `CommandPalette`, or `WorkflowEditor`, switch to `<Workspace />` and use the `enable*` props to disable what you don't need.

## Next steps

- [Embed the SDK](./embed-sdk) — the React 19 path with `<Workspace />`.
- [SDK reference](../sdk) — full `LokvisRuntime` API.
- [Architecture: Runtime](../architecture/runtime) — `AssetStore` 3-tier fallback, `HistoryStack`, `MemoryGuard` internals.

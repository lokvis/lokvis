---
title: 构建自定义 Workspace
description: 仅用 @lokvis/sdk + @lokvis/plugin-image（不使用 @lokvis/ui-react）构建一个最小图像工作台 —— 导入、resize、运行、导出并处理 LokvisError。
draft: false
head: []
---

# 构建自定义 Workspace

本指南用纯 HTML + TypeScript 构建一个最小图像工作台，仅使用 `@lokvis/sdk` 与 `@lokvis/plugin-image`。无 React、无 `<Workspace />` —— 只用 Runtime API。你将导入文件、构建一个 resize 工作流、运行它、导出结果，并处理每一条 `LokvisError` 错误路径。

## 何时跳过 `<Workspace />`

| 维度 | `<Workspace />`（完整 UI） | 自定义 workspace（仅 Runtime） |
|---|---|---|
| 包体积 | 约 200 KB JS + React 19 | 约 80 KB JS（Runtime + engine-image） |
| 适用场景 | 面向终端用户的图像工具 | 嵌入非 React 技术栈（Vue/Svelte/原生）、CI 脚本、demo |
| 定制程度 | `enable*` props | 完全掌控 —— DOM 由你掌握 |
| 样板代码 | 约 10 行 | 约 150 行（文件输入、预览、状态、错误处理） |
| 历史 / undo | 内置 `HistoryPanel` | 你通过 `runtime.undo()` / `redo()` 实现 |
| 工作流编辑器 | 内置 `WorkflowEditor` | 你来构建 UI |

如果你想要开箱即用、功能齐全的图像工具，选 `<Workspace />`。如果你需要更小的包体积、非 React 宿主或严格受控的单用途工具，选自定义 workspace。

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

## 2. 初始化 Runtime

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
  // 第 1 步：把文件导入为 Lokvis Asset
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

    // 第 2 + 3 步：用输入资产运行工作流
    const result = await runtime.run(workflow, [inputAssetId]);
    if (result.status !== 'completed' || result.outputs.length === 0) {
      throw new Error(result.error || `Workflow ${result.status}`);
    }

    // 第 4 步：把输出资产导出回 Blob
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

## 4. 用 `fromLokvisError()` + `DegradationRejectedError` + `STORAGE_QUOTA_EXCEEDED` 处理错误

`fromLokvisError(value: unknown)` 把任何被抛出的值归一化为 `LokvisError` 实例，因此你只需一个 `catch` 块。它会：

1. 若已是 `LokvisError`，原样返回。
2. 用 `instanceof` 把已知 Runtime 错误子类（`QuotaExceededError`、`DegradationRejectedError`、`WorkerCrashedError` 等）包装为 SDK 等价物。
3. 对遗留的 `throw new Error(...)` 调用点回退到消息模式匹配。
4. 最后兜底返回 `UNKNOWN` `LokvisError`，保留 `cause`。

```ts
function handleLokvisError(err: unknown): void {
  // fromLokvisError() 总是返回 LokvisError —— 无需 `instanceof LokvisError` 守卫。
  const lokvisErr = fromLokvisError(err);

  // DegradationRejectedError 是 LokvisError 子类 —— 用 instanceof 收窄
  // 以访问 .guide 字段（用户可读的恢复建议）。
  if (lokvisErr instanceof DegradationRejectedError) {
    setStatus(`Image too large, rejected: ${lokvisErr.guide[0] ?? ''}`, true);
    return;
  }

  switch (lokvisErr.code) {
    case 'STORAGE_QUOTA_EXCEEDED': {
      // context 是 unknown 类型；使用前先收窄为数字
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

### 错误归一化阶梯

| 层 | 抛出的内容 | `fromLokvisError` 匹配方式 |
|---|---|---|
| Engine（Worker） | `DOMException('AbortError')` | 消息模式 → `WORKER_REQUEST_ABORTED` |
| Runtime（内存） | `DegradationRejectedError` | `instanceof` → `DEGRADATION_REJECTED`（带 `.guide`） |
| Runtime（存储） | `QuotaExceededError` | `instanceof` → `STORAGE_QUOTA_EXCEEDED`（带 `usage`/`delta`/`quota`） |
| Runtime（worker） | `WorkerCrashedError`, `WorkerDeadError`, `WorkerHandshakeError`, … | `instanceof` → 对应的 `WORKER_*` 错误码 |
| Executor | `Error('No implementation registered for capability "…"')` | 消息模式 → `CAPABILITY_NOT_REGISTERED` |
| SDK | `PluginLoadError`, `AssetNotFoundError`, … | 已是 `LokvisError` 子类 —— 原样返回 |

`LokvisError.code` 是用于程序分支的**稳定契约**。类名可能跨版本变化；错误码不会。

## 5. 运行

安装依赖并用 Vite（或任何能处理 `crypto.randomUUID` 与 `OffscreenCanvas` 的打包器）运行：

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image
pnpm add -D vite typescript
pnpm vite
```

## 对比：自定义 vs `<Workspace />`

| 特性 | 自定义（本指南） | `<Workspace />` |
|---|---|---|
| 导入 | `@lokvis/sdk` + `@lokvis/plugin-image` | `+ @lokvis/ui-react` |
| 总行数 | 约 150 | 约 10 |
| 文件选择器 | 你来构建 | `<GlobalDropzone />` |
| 工作流编辑器 | 无 | `<WorkflowEditor />`（拖拽） |
| 历史面板 | 无（或调用 `runtime.undo()`） | `<HistoryPanel />`（游标 + 跳转） |
| 对比滑块 | 无 | `<CompareSlider />` |
| 错误横幅 | `handleLokvisError()` | `<ErrorBanner />`（渲染错误码 + 消息） |
| 存储计量 | `runtime.getStorageUsage()` | `<StatusBar />`（自动刷新） |
| 包体积 | 约 80 KB | 约 200 KB + React 19 |

如果你发现自己重建 `HistoryPanel`、`CommandPalette` 或 `WorkflowEditor`，请改用 `<Workspace />` 并通过 `enable*` props 关闭不需要的部分。

## 后续步骤

- [嵌入 SDK](./embed-sdk) —— 使用 `<Workspace />` 的 React 19 路径。
- [SDK 参考](../sdk) —— 完整的 `LokvisRuntime` API。
- [架构：Runtime](../architecture/runtime) —— `AssetStore` 三级回退、`HistoryStack`、`MemoryGuard` 内部机制。

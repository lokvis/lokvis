---
title: CLI 自动化
description: 在 Node.js 中使用 @lokvis/cli 进行能力发现、工作流结构校验和 CI 检查。了解为什么图像能力需要 Playwright 无头浏览器。
draft: false
head: []
---

# CLI 自动化

`@lokvis/cli` 是 Lokvis 的终端入口。它**不是**一个完整的 Node.js Runtime —— Runtime 按设计是浏览器优先的。CLI 面向你在 CI 中通常需要的无副作用操作：能力发现、工作流结构校验、插件脚手架、版本检查。本指南展示如何以编程方式调用它，以及 Node.js 边界在哪里。

## 1. 编程式 API

`@lokvis/cli` 导出 `runCLI(argv)`，与 `lokvis` bin 脚本使用的是同一函数。你可以从任何 Node.js 脚本中导入它：

```ts
import { runCLI } from '@lokvis/cli';

// 等价于：lokvis capabilities
await runCLI(['capabilities']);
```

`runCLI` 直接写入 `process.stdout` 并返回 `Promise<void>`。遇到未知命令或非法参数时抛错。

## 2. 能力查询：`runCLI(['capabilities'])`

`capabilities` 命令列出 `@lokvis/capability` 中 `BUILTIN_CAPABILITIES` 声明的每个能力 —— 即 Runtime 用来播种注册表的同一数组。

```ts
import { runCLI } from '@lokvis/cli';

await runCLI(['capabilities']);
```

示例输出：

```
Capabilities (22):
  image.resize                Resize image to specified dimensions
  image.compress              Compress image with specified quality
  image.convert               Convert image to another format
  image.crop                  Crop image to a region
  ...
  asset.rename                Rename asset using a pattern
  asset.archive               Pack multiple assets into a zip archive
  developer.inspect.capabilities   List all registered capabilities
  developer.inspect.asset          Inspect asset metadata and structure
  developer.validate.workflow      Validate a workflow without executing it
  developer.profile                Profile capability execution time
```

如需不带打印的编程式访问，可直接导入底层函数：

```ts
import { listCapabilities } from '@lokvis/cli';
const caps = listCapabilities();
console.log(caps.map(c => c.name));
```

## 3. 工作流校验：`validateWorkflow()`

`@lokvis/schema` 导出 `validateWorkflow(data, options?)`，返回 Zod `SafeParseReturnType` 形态的结果。形态为：

```ts
type Result =
  | { success: true; data: Workflow }
  | { success: false; error: { issues: Array<{ code: string; message: string; path: PropertyKey[] }> } };
```

你可以不经 CLI 直接使用它：

```ts
import { validateWorkflow } from '@lokvis/schema';
import type { Workflow } from '@lokvis/schema';

const sample: Workflow = {
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

const result = validateWorkflow(sample, { maxSteps: 5 });
if (!result.success) {
  for (const issue of result.error.issues) {
    console.error(`✗ ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`✓ Workflow "${result.data.id}" is valid`);
}
```

### 三层校验

`validateWorkflow` 跨三层执行结构检查：

1. **Zod schema 形状** —— 必填字段、类型枚举（`assetTypeSchema`、`workflowCategorySchema`、`workflowOutputTypeSchema`）、节点/边数组。
2. **拓扑检查** —— 保留哨兵 id（`__input__` / `__output__`）、节点 id 唯一性、边端点引用、自环、DAG 环检测（Kahn 算法）。
3. **能力兼容性**（可选，当提供 `resolveCapability` 时）—— 输入节点的 `inputTypes` 匹配 `workflow.inputs.type`；相邻节点的 `outputTypes ∩ inputTypes` 有交集；输出节点的 `outputTypes` 匹配 `workflow.outputs.type`。schema 包无法导入 `@lokvis/runtime`，因此 resolver 以回调形式注入。

```ts
import { validateWorkflow } from '@lokvis/schema';
import { BUILTIN_CAPABILITIES } from '@lokvis/capability';

const result = validateWorkflow(wf, {
  maxSteps: 5,
  resolveCapability: (name) => {
    const cap = BUILTIN_CAPABILITIES.find(c => c.name === name);
    return cap && { inputTypes: cap.inputTypes, outputTypes: cap.outputTypes };
  },
});
```

## 4. Node.js 局限

Lokvis Runtime 是**浏览器优先**的。图像引擎依赖：

- `createImageBitmap` —— 把 blob 解码为位图
- `OffscreenCanvas` —— 进行脱离 DOM 的渲染
- `canvas.convertToBlob()` / `canvas.toBlob()` —— 进行编码

这些在 Node.js 中都不可用。CLI 在内部构造 Runtime 时显式禁用 OPFS 与 IndexedDB：

```ts
const runtime = await createLokvis({
  enableOpfs: false,
  enableIndexedDB: false,
  plugins: options.plugins ?? [],
});
```

因此 `lokvis run ./workflow.json ./input.png` 对不触碰浏览器 API 的能力（例如 `asset.rename`）可用，但图像 / 视频 / PDF 能力会抛出 `createImageBitmap is not supported in this environment` 之类错误。

### 在 CI 中运行图像能力：Playwright

要在 CI 中运行图像工作流，用 Playwright 驱动无头浏览器：

```ts
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://your-app.example.com');

// 注入工作流 + 文件，然后调用 window.lokvis.run(...)
const fileBytes = readFileSync('./input.png');
const result = await page.evaluate(async (bytes) => {
  const file = new File([new Uint8Array(bytes)], 'input.png', { type: 'image/png' });
  const lokvis = (window as unknown as { lokvis: import('@lokvis/sdk').LokvisRuntime }).lokvis;
  const id = await lokvis.importAsset({ kind: 'file', file });
  return lokvis.run(WORKFLOW, [id]);
}, fileBytes);

console.log(result.status, result.duration);
await browser.close();
```

宿主页面必须以 COOP/COEP 头服务（见 [嵌入 SDK](./embed-sdk#5-coopcoep-headers-for-sharedarraybuffer)），才能使用 `SharedArrayBuffer`。

## 5. CLI 命令

| 命令 | 签名 | 描述 |
|---|---|---|
| `run` | `lokvis run <workflow.json> [files...]` | 加载工作流 JSON、导入输入文件并执行。依赖浏览器的能力（image、video、PDF）在 Node 中会失败 —— 请用 Playwright。 |
| `capabilities` | `lokvis capabilities`（别名：`caps`） | 列出来自 `@lokvis/capability` 的所有内置能力声明。 |
| `plugin create` | `lokvis plugin create <name> [target-dir]` | 用标准布局脚手架生成一个新插件包（`package.json`、`tsconfig.json`、`src/index.ts`、`src/plugin.ts`）。 |
| `mcp` | `lokvis mcp` | 启动 MCP 服务器（stdio JSON-RPC）。见 [MCP 集成](../mcp)。 |
| `version` | `lokvis version`（别名：`--version`、`-v`） | 打印 CLI 版本。 |
| `help` | `lokvis help`（别名：`--help`、`-h`） | 打印帮助文本。 |

## 6. CI 示例

一个典型的 CI 步骤，校验工作流并打印能力：

```ts
// scripts/ci-check.ts
import { runCLI } from '@lokvis/cli';
import { validateWorkflow } from '@lokvis/schema';
import { readFileSync } from 'node:fs';

async function main(): Promise<void> {
  // 1. 列出能力
  console.log('=== Capabilities ===');
  await runCLI(['capabilities']);

  // 2. 校验 ./workflows 下的每个工作流 JSON
  console.log('=== Workflow validation ===');
  for (const file of ['./workflows/web-optimize.json', './workflows/screenshot-compress.json']) {
    const wf = JSON.parse(readFileSync(file, 'utf-8'));
    const result = validateWorkflow(wf, { maxSteps: 5 });
    if (!result.success) {
      console.error(`✗ ${file}: ${result.error.issues.map(i => i.message).join('; ')}`);
      process.exitCode = 1;
    } else {
      console.log(`✓ ${file}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

用 `tsx scripts/ci-check.ts` 运行，或编译后执行。它无需启动浏览器即可成功。

## 后续步骤

- [CLI 参考](../cli) —— 快速命令概览。
- [MCP 集成](../mcp) —— 把同样的能力暴露给 AI 客户端。
- [Schema 参考](../architecture/runtime) —— `validateWorkflow` 背后的 Runtime 内部机制。

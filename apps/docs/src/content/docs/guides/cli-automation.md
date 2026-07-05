---
title: CLI Automation
description: Drive @lokvis/cli programmatically from a Node.js script for CI and automation.
draft: false
head: []
---

# CLI Automation

The Lokvis Runtime is browser-first — its image engine relies on `Canvas` and `createImageBitmap`, which Node.js does not implement. That does not mean CLI automation is impossible: capability discovery, workflow structure validation, and non-image capabilities (e.g. `asset.rename`) work fine in Node.

This guide shows how to use `@lokvis/cli` programmatically inside a Node.js script for CI checks, dashboards, and asset-rename pipelines.

> The complete source for this guide lives in [`examples/cli-automation/`](https://github.com/lokvis/lokvis/tree/dev/examples/cli-automation).

## What works in Node, what doesn't

| Capability class | Node.js | Why |
|------------------|---------|-----|
| Capability discovery (`lokvis capabilities`) | ✅ | Pure JSON, no rendering |
| Workflow structure validation | ✅ | `validateWorkflow()` is schema-only |
| `asset.rename`, `asset.load`, `asset.export` | ✅ | Blob plumbing only |
| `image.resize` / `compress` / `convert` / `crop` / `rotate` / `flip` / `watermark` / `setBackground` / `filter` | ❌ | Engine uses `OffscreenCanvas` + `createImageBitmap` |
| `video.*` / `pdf.*` / `audio.*` | ❌ | Stub engines (Phase 2 will add WASM) |

For image processing in CI, run a headless browser (Playwright / Puppeteer) against a deployed Playground — see [W16.5 Lighthouse / E2E](https://github.com/lokvis/lokvis/blob/dev/docs/PROJECT_PLAN.md).

## 1. Install

```bash
pnpm add @lokvis/cli @lokvis/schema
```

`@lokvis/schema` gives you the `Workflow` type for typed workflow definitions.

## 2. List capabilities

`runCLI(['capabilities'])` is the same entry point as the `lokvis capabilities` shell command. It writes to `process.stdout`:

```typescript
import { runCLI } from '@lokvis/cli';

await runCLI(['capabilities']);
```

Sample output:

```
image.resize         Resize image
image.compress       Compress image
image.convert        Convert image format
image.crop           Crop image
image.rotate         Rotate image
image.flip           Flip image
image.watermark      Add watermark
image.setBackground   Set background color
image.filter         Apply filter preset
asset.load           Load asset
asset.export         Export asset
asset.rename         Rename asset metadata
...
```

## 3. Validate a workflow in CI

Workflow structure validation is a pure schema check — no Runtime, no engine, no browser. Drop this snippet into your CI pipeline to fail fast on malformed workflow JSON before deploy.

```typescript
import type { Workflow } from '@lokvis/schema';

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

const result = validateWorkflow(sampleWorkflow);
if (!result.ok) {
  console.error(`✗ 校验失败:${result.error}`);
  process.exitCode = 1;
}
```

For full structural validation (capability compatibility between adjacent nodes, 5-step limit, input/output type matching), import `validateWorkflow` from `@lokvis/schema`. It returns a Zod `SafeParseReturnType` augmented with extra checks:

```typescript
import { validateWorkflow } from '@lokvis/schema';

const result = validateWorkflow(sampleWorkflow, { maxSteps: 5 });
if (!result.success) {
  // result.error 是 ZodError,加上自定义 errors 数组(保留字 / 兼容性等)
  console.error('Invalid workflow:', result.error.issues);
  process.exit(1);
}
```

## 4. Why `lokvis run` doesn't work for images in Node

If you try `runCLI(['run', './workflow.json', './input.png'])` for an image workflow, the CLI will:

1. ✅ Parse and validate the workflow JSON
2. ✅ Load the input file as a Blob
3. ❌ Call `runtime.run()` → `engine-image.resize()` → `createImageBitmap(blob)` → throws `ReferenceError: createImageBitmap is not defined`

This is by design — the Canvas engine is browser-only. Options:

- **Use Playwright**: Spin up a headless Chromium against your deployed Playground URL and drive it via the SDK in-page. See the [playwright example](https://github.com/lokvis/lokvis/tree/dev/examples) (planned W16.5).
- **Wait for WASM engines**: Phase 2 will add Squoosh / ffmpeg.wasm adapters that run in Node via `wasm-pack` + `Buffer` shims.
- **Use `asset.rename` only**: For pure-metadata workflows (rename, tag, archive) `runCLI(['run', ...])` works in Node today.

## 5. Putting it together

A complete CI script:

```typescript
import { runCLI } from '@lokvis/cli';
import type { Workflow } from '@lokvis/schema';
import { validateWorkflow } from '@lokvis/schema';

const sampleWorkflow: Workflow = { /* ...as above... */ };

async function main(): Promise<void> {
  console.log('=== 1. 列出内置能力(runCLI capabilities)===');
  await runCLI(['capabilities']);
  console.log();

  console.log('=== 2. 校验工作流结构 ===');
  const result = validateWorkflow(sampleWorkflow, { maxSteps: 5 });
  if (result.success) {
    console.log(`✓ Workflow "${sampleWorkflow.id}" 校验通过`);
  } else {
    const msgs = result.error.issues.map((i) => i.message).join('; ');
    console.error(`✗ 校验失败:${msgs}`);
    process.exitCode = 1;
    return;
  }
  console.log();

  console.log('=== 3. 关于在 Node 中运行工作流 ===');
  console.log('图像能力(image.resize 等)依赖浏览器 Canvas,无法在 Node 中执行。');
  console.log('CI 中建议仅做能力查询与工作流校验。');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

Run it:

```bash
npx tsx examples/cli-automation/automate.ts
```

## Available CLI commands

| Command | Purpose | Node-compatible |
|---------|---------|-----------------|
| `lokvis capabilities` | List registered capabilities | ✅ |
| `lokvis run <workflow.json> <input>` | Execute a workflow | ⚠️ only non-image capabilities |
| `lokvis plugin create <name>` | Scaffold a new plugin package | ✅ |
| `lokvis mcp` | Start the MCP server (stdio) | ✅ |
| `lokvis version` | Print Runtime version | ✅ |
| `lokvis help` | Print help | ✅ |

## Programmatic API

`runCLI(argv)` is the only public programmatic entry point — it mirrors the shell command exactly. For deeper control (custom plugin loading, custom storage), use `createLokvis()` from `@lokvis/sdk` directly — but note that the browser-API limitation still applies.

## Next steps

- [Custom Workspace](./custom-workspace) — same SDK, in the browser
- [SDK reference](../sdk) — full Runtime API
- [CLI reference](../cli) — shell usage

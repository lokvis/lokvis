---
title: CLI Automation
description: Use @lokvis/cli in Node.js for capability discovery, workflow structure validation, and CI checks. Learn why image capabilities need a Playwright headless browser.
draft: false
head: []
---

# CLI Automation

`@lokvis/cli` is Lokvis's terminal entry point. It is **not** a full Node.js runtime — the Runtime is browser-first by design. The CLI is for the side-effect-free operations you typically need in CI: capability discovery, workflow structure validation, plugin scaffolding, and version checks. This guide shows you how to call it programmatically and where the Node.js boundary lies.

## 1. Programmatic API

`@lokvis/cli` exports `runCLI(argv)`, which is the same function the `lokvis` bin script uses. You can import it from any Node.js script:

```ts
import { runCLI } from '@lokvis/cli';

// Equivalent to: lokvis capabilities
await runCLI(['capabilities']);
```

`runCLI` writes directly to `process.stdout` and returns `Promise<void>`. It throws on unknown commands or invalid arguments.

## 2. Capability query: `runCLI(['capabilities'])`

The `capabilities` command lists every capability declared in `@lokvis/capability`'s `BUILTIN_CAPABILITIES` — the same array the Runtime uses to seed its registry.

```ts
import { runCLI } from '@lokvis/cli';

await runCLI(['capabilities']);
```

Sample output:

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

For programmatic access without printing, import the underlying function:

```ts
import { listCapabilities } from '@lokvis/cli';
const caps = listCapabilities();
console.log(caps.map(c => c.name));
```

## 3. Workflow validation: `validateWorkflow()`

`@lokvis/schema` exports `validateWorkflow(data, options?)`, which returns a Zod `SafeParseReturnType`-shaped result. The shape is:

```ts
type Result =
  | { success: true; data: Workflow }
  | { success: false; error: { issues: Array<{ code: string; message: string; path: PropertyKey[] }> } };
```

You can use it directly without going through the CLI:

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

### Three validation layers

`validateWorkflow` performs structural checks across three layers:

1. **Zod schema shape** — required fields, type enums (`assetTypeSchema`, `workflowCategorySchema`, `workflowOutputTypeSchema`), node/edge arrays.
2. **Topology checks** — reserved sentinel ids (`__input__` / `__output__`), node id uniqueness, edge endpoint references, self-loops, DAG cycle detection (Kahn's algorithm).
3. **Capability compatibility** (optional, when `resolveCapability` is provided) — input node `inputTypes` matches `workflow.inputs.type`; adjacent nodes have `outputTypes ∩ inputTypes` overlap; output node `outputTypes` matches `workflow.outputs.type`. The schema package can't import from `@lokvis/runtime`, so the resolver is injected as a callback.

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

## 4. Node.js limitations

Lokvis Runtime is **browser-first**. The image engine depends on:

- `createImageBitmap` — for decoding blobs to bitmaps
- `OffscreenCanvas` — for off-DOM rendering
- `canvas.convertToBlob()` / `canvas.toBlob()` — for encoding

None of these are available in Node.js. The CLI explicitly disables OPFS and IndexedDB when constructing the Runtime internally:

```ts
const runtime = await createLokvis({
  enableOpfs: false,
  enableIndexedDB: false,
  plugins: options.plugins ?? [],
});
```

So `lokvis run ./workflow.json ./input.png` works for capabilities that don't touch the browser APIs (e.g. `asset.rename`), but image / video / PDF capabilities will throw `createImageBitmap is not supported in this environment` or similar.

### Running image capabilities in CI: Playwright

To run image workflows in CI, drive a headless browser with Playwright:

```ts
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://your-app.example.com');

// Inject the workflow + file, then call window.lokvis.run(...)
const fileBytes = readFileSync('./input.png');
const result = await page.evaluate(async (bytes) => {
  const file = new File([new Uint8Array(bytes)], 'input.png', { type: 'image/png' });
  const id = await (window as any).lokvis.importAsset({ kind: 'file', file });
  return (window as any).lokvis.run(WORKFLOW, [id]);
}, fileBytes);

console.log(result.status, result.duration);
await browser.close();
```

The host page must be served with COOP/COEP headers (see [Embed the SDK](./embed-sdk#5-coopcoep-headers-for-sharedarraybuffer)) so `SharedArrayBuffer` is available.

## 5. CLI commands

| Command | Signature | Description |
|---|---|---|
| `run` | `lokvis run <workflow.json> [files...]` | Load a workflow JSON, import input files, and execute. Browser-dependent capabilities (image, video, PDF) will fail in Node — use Playwright for those. |
| `capabilities` | `lokvis capabilities` (alias: `caps`) | List all built-in capability declarations from `@lokvis/capability`. |
| `plugin create` | `lokvis plugin create <name> [target-dir]` | Scaffold a new plugin package with the standard layout (`package.json`, `tsconfig.json`, `src/index.ts`, `src/plugin.ts`). |
| `mcp` | `lokvis mcp` | Start the MCP server (stdio JSON-RPC). See [MCP Integration](../mcp). |
| `version` | `lokvis version` (aliases: `--version`, `-v`) | Print the CLI version. |
| `help` | `lokvis help` (aliases: `--help`, `-h`) | Print the help text. |

## 6. CI example

A typical CI step that validates workflows and prints capabilities:

```ts
// scripts/ci-check.ts
import { runCLI } from '@lokvis/cli';
import { validateWorkflow } from '@lokvis/schema';
import { readFileSync } from 'node:fs';

async function main(): Promise<void> {
  // 1. List capabilities
  console.log('=== Capabilities ===');
  await runCLI(['capabilities']);

  // 2. Validate every workflow JSON in ./workflows
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

Run it with `tsx scripts/ci-check.ts` or compile and execute. It will succeed without ever spinning up a browser.

## Next steps

- [CLI reference](../cli) — quick command overview.
- [MCP Integration](../mcp) — expose the same capabilities to AI clients.
- [Schema reference](../architecture/runtime) — Runtime internals behind `validateWorkflow`.

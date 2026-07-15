# CLI Automation Example

Shows how to use `@lokvis/cli` programmatically to run image workflows in Node.js scripts, useful for build pipelines and CI/CD.

## What it demonstrates

- Call `runCLI(['capabilities'])` programmatically to list built-in capabilities
- **Real `image.resize` in Node.js** — since M2.2, `@lokvis/cli`'s `runWorkflow` injects `imageToolsPluginNode` (sharp engine) by default, so image.resize / compress / convert / crop / watermark run natively in Node without a browser Canvas
- Generate a test image with `sharp`, run a resize workflow, verify the output dimensions

## Files

- `automate.ts` — Node.js script that drives `runWorkflow` from `@lokvis/cli`
- `.github/workflows/resize-ci.yml` — GitHub Actions workflow that runs `automate.ts` as an image CI gate

## How to run

From the `lokvis-open` monorepo root:

```bash
# 1. Build all packages(generates dist/ for @lokvis/cli + dependencies)
pnpm build

# 2. Run the example
pnpm --filter @lokvis/example-cli-automation start
# or
npx tsx examples/cli-automation/automate.ts
```

Expected output (abridged):

```
=== 1. 列出内置能力(runCLI capabilities) ===
Capabilities (40):
  image.resize             Resize image to specified dimensions
  ...
=== 2. 真实跑 image.resize(sharp 引擎) ===
✓ 生成测试图: /tmp/lokvis-cli-automation/input.png (1920x1080 PNG)
→ runWorkflow('.../resize.json', ['.../input.png'], { output: '.../output.png' })
[lokvis-image-tools] Registered 9 image capabilities (sharp engine, 5 real + 4 stub) + EXIF reader
✓ 工作流执行完成: status=completed, duration=Nms, outputs=1
✓ 输出文件: /tmp/lokvis-cli-automation/output.png (1280x720 png, NNNN bytes)
  resize 行为验证:1920x1080 → 1280x720(fit=cover,目标 1280x720)
```

## GitHub Actions CI example

The included `.github/workflows/resize-ci.yml` shows a minimal CI gate:

- Triggers on push/PR to `main`
- Sets up Node 22 + pnpm
- Builds the monorepo
- Runs `automate.ts` — if the resize fails, the CI step fails
- Uploads the output PNG as a workflow artifact

Copy this workflow into your own repo's `.github/workflows/` to add image-processing CI gates (e.g. generate OG previews, validate uploaded assets, normalize image dimensions).

## Programmatic API

```ts
import { runWorkflow, runCLI } from '@lokvis/cli';

// Run a workflow on input files, write first output to disk
const result = await runWorkflow(
  './resize.json',
  ['./input.png'],
  { output: './output.png' }
);
// result.status === 'completed', result.outputs === ['asset-id']

// Or drive the CLI entry point directly (writes to stdout)
await runCLI(['capabilities']);
await runCLI(['run', './resize.json', '--input', './input.png', '--output', './output.png']);
```

See [@lokvis/cli README](../../packages/cli/README.md) for the full `RunOptions` reference.

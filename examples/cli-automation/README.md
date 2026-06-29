# CLI Automation Example

Shows how to use `@lokvis/cli` programmatically to run workflows in Node.js scripts, useful for build pipelines and CI/CD.

## Files

- `automate.ts` — Node.js script that drives `runCLI` from `@lokvis/cli`

## How to run

From the `lokvis-open` monorepo root:

```bash
# 1. Build all packages
pnpm build

# 2. Run with tsx / ts-node (or compile then run with node)
npx tsx examples/cli-automation/automate.ts
```

## What it demonstrates

- Call `runCLI(['capabilities'])` programmatically to list built-in capabilities
- Construct a `Workflow` object and validate its structure (same checks as `lokvis run`)
- Document the Node.js limitation: image capabilities rely on the browser `Canvas` / `createImageBitmap` APIs and cannot execute in Node — so `lokvis run` in CI is best used for capability queries, workflow validation, or Canvas-free capabilities such as `asset.rename`

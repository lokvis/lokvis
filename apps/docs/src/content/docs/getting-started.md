---
title: Getting Started
description: Install Lokvis, run the web app, and embed the runtime in your project.
draft: false
head: []
---

# Getting Started

This guide walks you through installing Lokvis, running the playground, and embedding the Runtime SDK in your own web app.

## Prerequisites

- **Node.js** ≥ 22 LTS (22.x recommended)
- **pnpm** ≥ 9.12.0 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- **Browser**: Any modern browser supporting OffscreenCanvas + createImageBitmap + OPFS (Chrome 102+ / Edge 102+ / Safari 16.4+ / Firefox 111+)

> Lokvis is a local-first tool — **all processing happens in the browser; no files are uploaded**.

## 1. Clone & Install

```bash
git clone https://github.com/lokvis/lokvis.git
cd lokvis
pnpm install
```

The repository is a pnpm monorepo containing 18+ `@lokvis/*` packages plus the `apps/playground` Astro app.

## 2. Run the Playground

```bash
pnpm dev --filter @lokvis/playground
# → http://localhost:5601/playground
```

The playground provides:
- 8 tool pages (resize / compress / convert / crop / watermark / batch watermark / batch processing / download)
- Workflow editor (drag-and-drop + templates + share links)
- History panel (undo/redo)
- Privacy indicator (offline detection + Local-only badge)

## 3. Build & Test

```bash
pnpm typecheck   # Full type check (36 packages)
pnpm build       # Build (20 tasks)
pnpm test        # Run tests
pnpm test:coverage  # Coverage report
```

## 4. Embed the Runtime SDK

`@lokvis/sdk` is the easiest way to embed the Lokvis Runtime in any web app.

### Install

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image
```

### Minimal example

```typescript
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';
import { WorkflowBuilder } from '@lokvis/workflow';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
});

// Import file
const assetId = await lokvis.importAsset({ kind: 'file', file });

// Define a workflow (recommended: WorkflowBuilder)
const workflow = new WorkflowBuilder({ id: 'wf_demo', name: 'Web Optimize' })
  .setInput({ type: 'image', multiple: false })
  .setOutput({ type: 'image', format: 'webp' })
  .add('image.resize', { width: 1920, height: 1080, fit: 'inside' })
  .add('image.compress', { quality: 80 })
  .add('image.convert', { format: 'webp' })
  .build();

// Run
const result = await lokvis.run(workflow, [assetId]);
const outputBlob = await lokvis.exportAsset(result.outputs[0]);
```

## 5. Use the Workspace UI

`@lokvis/ui-react` provides a complete Workspace component that can be embedded in any React 19 app.

```bash
pnpm add @lokvis/ui-react @lokvis/plugin-image
```

```tsx
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

function App() {
  return (
    <Workspace
      title="My Image Tools"
      plugins={[imageToolsPlugin()]}
      enableWorkflowEditor
      enableCommandPalette
      enableCompare
    />
  );
}
```

`Workspace` exposes 5 `enable*` props that let you toggle sub-features on demand, including a mobile drawer mode.

## 6. Sentry Monitoring (optional)

The playground ships with Sentry integration built in (W12.3). Configure the DSN at deploy time to enable it:

```bash
# apps/playground/.env
PUBLIC_SENTRY_DSN=https://your-key@sentry.io/project-id
PUBLIC_SENTRY_RELEASE=playground@0.1.0
```

When no DSN is configured, the entire module becomes a no-op — zero overhead for local development and self-hosted users. See the [W12.3 design](https://github.com/lokvis/lokvis/blob/dev/docs/PROJECT_PLAN.md#123-sentry-监控接入).

## 7. Next Steps

- [Architecture](./architecture) — Five-layer architecture, Worker isolation, HistoryStack, and the AssetStore three-tier fallback
- [SDK](./sdk) — Full API reference for `@lokvis/sdk`
- [MCP Integration](https://github.com/lokvis/lokvis/blob/dev/docs/mcp-integration.md) — Expose Lokvis capabilities to Claude / ChatGPT / Cursor
- [Plugin Development](https://github.com/lokvis/lokvis/blob/dev/docs/plugins.md) — Plugin SDK structure and the PluginContext API
- [Project Plan](https://github.com/lokvis/lokvis/blob/dev/docs/PROJECT_PLAN.md) — Phase 1 hour-level task breakdown across 24 weeks

## Troubleshooting

| Problem | Cause | Solution |
|------|------|------|
| `pnpm install` reports `ERR_PNPM_OUTDATED_LOCKFILE` | lockfile out of sync with package.json | `pnpm install --no-frozen-lockfile` |
| Playground white screen + console reports `SharedArrayBuffer is not defined` | COOP/COEP not configured | Already configured in `apps/playground/astro.config.mjs`; production deployments must add it to the CDN `_headers` file |
| `createLokvis` reports `CAPABILITY_NOT_REGISTERED` | Plugin not loaded | `plugins: [imageToolsPlugin()]` |
| Worker crashes and still fails after restart | Browser out of memory | Reduce batch concurrency / use a smaller source image |
| `STORAGE_QUOTA_EXCEEDED` | OPFS/IDB quota full | `lokvis.removeAsset(id)` to clean up / raise `storageQuota` |

## Feedback

- 🐛 Bugs: [GitHub Issues](https://github.com/lokvis/lokvis/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/lokvis/lokvis/discussions)
- 📧 Email: hello@lokvis.com

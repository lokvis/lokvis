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
- **Browser**: any modern browser that supports OffscreenCanvas + createImageBitmap + OPFS (Chrome 102+ / Edge 102+ / Safari 16.4+ / Firefox 111+)

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
- Workflow editor (drag-and-drop + templates + shareable links)
- History panel (undo/redo)
- Privacy indicator (offline detection + Local-only badge)

## 3. Build & Test

```bash
pnpm typecheck   # Full type check (36 packages)
pnpm build       # Build (20 tasks)
pnpm test        # Run tests (777 tests)
pnpm test:coverage  # Coverage (lines 91%+ / branches 88%+)
```

## 4. Embed the Runtime SDK

`@lokvis/sdk` is the simplest way to embed the Lokvis Runtime into any web application.

### Installation

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image
```

### Minimal example

```typescript
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
});

// Import file
const assetId = await lokvis.importAsset({ kind: 'file', file });

// Define workflow (linear, max 5 steps)
const workflow = {
  id: 'demo',
  name: 'Web Optimize',
  category: 'web',
  inputs: { type: 'image/*' },
  outputs: [{ type: 'image/webp', label: 'optimized' }],
  nodes: [
    { id: 'n1', capability: 'image.resize', params: { width: 1920, height: 1080, fit: 'inside' } },
    { id: 'n2', capability: 'image.compress', params: { quality: 80 } },
    { id: 'n3', capability: 'image.convert', params: { format: 'webp' } },
  ],
  edges: [
    { from: 'input', to: 'n1' },
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'output' },
  ],
};

// Execute
const result = await lokvis.run(workflow, [assetId]);
const outputBlob = await lokvis.exportAsset(result.outputs[0]);
```

## 5. Use the Workspace UI

`@lokvis/ui-react` provides a full Workspace component that can be embedded into any React 19 application.

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

`Workspace` exposes 5 `enable*` props so you can turn off individual features on demand, making it adaptable to mobile drawer mode.

## 6. Sentry Monitoring (optional)

The playground ships with built-in Sentry integration (W12.3). Configure the DSN at deploy time to enable it:

```bash
# apps/playground/.env
PUBLIC_SENTRY_DSN=https://your-key@sentry.io/project-id
PUBLIC_SENTRY_RELEASE=playground@0.1.0
```

When no DSN is configured, the entire module degrades to a no-op, keeping local development and self-hosted deployments zero-overhead. See the [W12.3 design](https://github.com/lokvis/lokvis/blob/dev/docs/PROJECT_PLAN.md#123-sentry-监控接入) for details.

## 7. Next steps

- [Architecture](./architecture) — five-layer architecture, Worker isolation, HistoryStack, and AssetStore three-tier fallback
- [SDK](./sdk) — full API reference for `@lokvis/sdk`
- [MCP Integration](https://github.com/lokvis/lokvis/blob/dev/docs/mcp-integration.md) — expose Lokvis capabilities to Claude / ChatGPT / Cursor
- [Plugin Development](https://github.com/lokvis/lokvis/blob/dev/docs/plugins.md) — Plugin SDK structure and PluginContext API
- [Project Plan](https://github.com/lokvis/lokvis/blob/dev/docs/PROJECT_PLAN.md) — Phase 1 week-by-week, hour-level task breakdown across 24 weeks

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `pnpm install` reports `ERR_PNPM_OUTDATED_LOCKFILE` | lockfile is out of sync with package.json | `pnpm install --no-frozen-lockfile` |
| Playground shows a blank screen + Console reports `SharedArrayBuffer is not defined` | COOP/COEP not configured | Already configured in `apps/playground/astro.config.mjs`; for production, set it in your CDN `_headers` |
| `createLokvis` reports `CAPABILITY_NOT_REGISTERED` | No plugin loaded | `plugins: [imageToolsPlugin()]` |
| Worker crashes and still fails after restart | Browser out of memory | Reduce batch concurrency / use smaller source images |
| `STORAGE_QUOTA_EXCEEDED` | OPFS/IDB quota full | `lokvis.removeAsset(id)` to clean up / raise `storageQuota` |

## Feedback

- 🐛 Bugs: [GitHub Issues](https://github.com/lokvis/lokvis/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/lokvis/lokvis/discussions)
- 📧 Email: hello@lokvis.com

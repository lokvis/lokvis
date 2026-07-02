# Lokvis

> **Local Vision. Browser Workspace. Everything runs in your browser.**

Lokvis is a **Local-first Browser Workspace Platform**. Process images, videos, PDFs, and audio files entirely on your device — no uploads, no servers, no compromises.

## Architecture

Lokvis follows a **five-layer architecture** with **Open Core** model:

```
UI Layer          Astro 7 (SEO) + React 19 (Workspace SPA)
Workflow Layer    JSON declarative workflows + visual editor + marketplace
Runtime Layer     Scheduler / State / Event Bus / History / Asset Store
Capability Layer  Resize / Compress / Convert / OCR / Caption...
Engine Layer      FFmpeg.wasm / Squoosh / pdf-lib / Whisper / WebCodecs
```

**Three Principles:**
1. **Everything is a Package** — All features are independent packages for monorepo management
2. **Everything is a Capability** — Runtime only orchestrates capabilities, never depends on specific engines
3. **Everything Runs Locally** — All core workflows run in the browser; Cloudflare only handles edge services

## Monorepo Structure

```
lokvis-open/
├── apps/
│   ├── docs/                   # Astro documentation site
│   └── playground/             # Online SDK playground
├── packages/
│   ├── schema/                 # Workflow / Asset / Plugin type definitions
│   ├── runtime/                # Browser-local execution engine
│   ├── sdk/                    # JS SDK (createLokvis factory)
│   ├── plugin-sdk/             # Plugin development SDK
│   ├── capability/             # Standard capability names & presets
│   ├── ui-core/                # Shared React design system
│   ├── ui-react/               # Workspace UI (AssetPanel/Canvas/Inspector/...)
│   ├── cli/                    # lokvis CLI tool
│   ├── engine-image/           # Image engine (Canvas MVP, Squoosh/WebCodecs future)
│   ├── engine-video/           # Video engine (ffmpeg.wasm stub)
│   ├── engine-pdf/             # PDF engine (pdf-lib stub)
│   ├── engine-audio/           # Audio engine (Web Audio API stub)
│   ├── engine-ai/              # AI engine (transformers.js / cloud-proxy stub)
│   ├── plugin-image/           # Official image tools plugin (8 capabilities)
│   ├── plugin-video/           # Official video tools plugin (stub)
│   ├── plugin-pdf/             # Official PDF tools plugin (stub)
│   └── plugin-dev/             # Developer tools plugin (real impl)
└── examples/
    ├── custom-workspace/       # Build a custom workspace without ui-react
    ├── cli-automation/         # Use @lokvis/cli in Node.js scripts
    └── embedding/              # Embed Workspace into an existing React app
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Install

```bash
pnpm install
```

### Develop

```bash
# Start web app (Image Workspace) in dev mode
pnpm dev --filter @lokvis/web

# Start documentation site
pnpm dev --filter @lokvis/docs

# Start playground
pnpm dev --filter @lokvis/playground

# Build all packages
pnpm build

# Type check
pnpm typecheck
```

## Key Packages

### @lokvis/schema
The stable core. Type definitions for Asset, Workflow, Capability, Plugin, and Event. Changes slowly, strict semver.

### @lokvis/runtime
The browser-local execution engine. Orchestrates workflows, manages assets, emits events. Never depends on React or Cloud.

### @lokvis/sdk
The public SDK. `createLokvis()` factory to embed the Runtime in any web app.

```typescript
import { createLokvis } from '@lokvis/sdk';
import imageToolsPlugin from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
});

const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(workflow, [assetId]);
```

### @lokvis/ui-react
Complete Workspace UI for React 19. Drop-in component for image processing.

```tsx
import { Workspace } from '@lokvis/ui-react';
import imageToolsPlugin from '@lokvis/plugin-image';

function App() {
  return <Workspace plugins={[imageToolsPlugin()]} />;
}
```

### @lokvis/plugin-image
Official image tools plugin. Implements 8 capabilities via Canvas engine:
`image.resize / compress / convert / crop / rotate / flip / watermark / background`

### @lokvis/plugin-sdk
Build plugins that register capabilities to the Runtime.

```typescript
import { definePlugin } from '@lokvis/plugin-sdk';

export default definePlugin({
  name: 'my-image-tools',
  version: '1.0.0',
  capabilities: [
    {
      name: 'image.resize',
      description: 'Resize image',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [{ name: 'width', type: 'number' }],
      performance: 'fast',
    },
  ],
});
```

### @lokvis/cli
Terminal access to Lokvis.

```bash
lokvis run ./workflow.json ./input.png
lokvis capabilities
lokvis plugin create my-plugin
```

## Capability Catalog

| Domain | Capabilities |
|--------|--------------|
| `image.*` | resize, compress, convert, crop, rotate, flip, watermark, background |
| `video.*` | compress, transcode, trim, merge, extract-audio, to-gif, screenshot |
| `pdf.*` | merge, split, compress, rotate, watermark, ocr, sign |
| `asset.*` | rename, archive |
| `developer.*` | inspect.capabilities, inspect.asset, validate.workflow, profile |

## Design Constraints

- `lokvis-open` packages **never** import `lokvis-cloud`
- Runtime **never** knows about React
- Schema **never** knows about Runtime
- Plugin **never** knows about Cloud

## MVP Status (Phase 1)

- ✅ Runtime + SDK + Plugin SDK
- ✅ Image engine (Canvas) + Image plugin (8 capabilities)
- ✅ Workspace UI (AssetPanel / Canvas / Inspector / HistoryPanel)
- ✅ Web app (Image Workspace) — fully functional
- ✅ CLI tool (run / capabilities / plugin create)
- ✅ Documentation site
- ✅ Playground
- 🚧 Video / PDF / Audio engines (stubs ready, awaiting WASM integration)
- 🚧 Plugin Marketplace (Phase 2)

## License

MIT

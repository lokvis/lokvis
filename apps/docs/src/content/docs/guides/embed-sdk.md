---
title: Embed the SDK
description: Embed the Lokvis Workspace into an existing React app using @lokvis/ui-react.
draft: false
head: []
---

# Embed the SDK

This guide walks you through embedding the full Lokvis Workspace into an existing React 19 application with a single `<Workspace />` component. This is the fastest path when you already have a host UI (sidebar + main area) and want to drop Lokvis in as one of its panes.

> The complete source for this guide lives in [`examples/embedding/`](https://github.com/lokvis/lokvis/tree/dev/examples/embedding).

## What you get

After this guide your host app will render a fully wired workspace:

- Asset import via drag-and-drop or file picker
- A canvas + inspector + history + download panel layout
- The image tools plugin (resize / compress / convert / crop / rotate / flip / watermark / setBackground / filter)
- Workflow editor + command palette + share link
- All processing happens locally — no file leaves the browser

## Prerequisites

- An existing **React 19 + Vite** (or compatible) app
- Node.js ≥ 22 LTS, pnpm ≥ 9.12
- A working build of the Lokvis packages (run `pnpm build` at the monorepo root)

## 1. Install the dependencies

In your host project:

```bash
pnpm add @lokvis/ui-react @lokvis/sdk @lokvis/runtime @lokvis/plugin-image
```

Only `@lokvis/ui-react` and `@lokvis/plugin-image` are required at runtime — `@lokvis/sdk` and `@lokvis/runtime` are peer dependencies that ship as part of the workspace graph.

## 2. Render `<Workspace />`

`<Workspace />` initializes the Runtime itself via the `useLokvis` hook — you only need to pass the plugins you want to load. There is no need to call `createLokvis()` manually.

```tsx
import * as React from 'react';
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const plugins = [imageToolsPlugin()];

export default function App(): React.ReactElement {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Host app sidebar — already exists in your app */}
      <aside style={{ width: 220, background: '#18181b', color: '#e4e4e7' }}>
        <h2 style={{ fontSize: 16, padding: 16, margin: 0 }}>My App</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {['Home', 'Library', 'Workspace', 'Settings'].map((item) => (
            <li
              key={item}
              style={{
                padding: '10px 16px',
                background: item === 'Workspace' ? '#27272a' : 'transparent',
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main area — Lokvis Workspace lives here */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <Workspace
          title="Lokvis Workspace"
          plugins={plugins}
          showStatusBar
        />
      </main>
    </div>
  );
}
```

## 3. Mount it from your entry point

```tsx
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 4. Run the dev server

If you are working inside the monorepo, the easiest way to try this example is with Vite:

```bash
# From the monorepo root
pnpm build                              # 1. Build all @lokvis/* packages
npx vite examples/embedding             # 2. Serve the example
# → http://localhost:5173
```

If your host app is outside the monorepo, just run your usual `pnpm dev` — the workspace will load from `node_modules` like any other dependency.

## What the `Workspace` component accepts

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `plugins` | `Plugin[]` | `[]` | Plugins to preload at Runtime startup (e.g. `imageToolsPlugin()`) |
| `title` | `string` | — | Title rendered in the toolbar |
| `showStatusBar` | `boolean` | `false` | Show the bottom status bar (memory pressure, runtime state) |
| `enableWorkflowEditor` | `boolean` | `true` | Toggle the drag-and-drop workflow editor |
| `enableCommandPalette` | `boolean` | `true` | Toggle ⌘K command palette |
| `enableCompare` | `boolean` | `true` | Toggle before/after compare slider |

The five `enable*` props let you progressively strip features down for a minimal mobile/embedded experience.

## How the Runtime is initialized

You do **not** call `createLokvis()` yourself when using `<Workspace />`. Internally:

1. `useLokvis({ plugins })` runs once on mount
2. It calls `createLokvis({ plugins })` from `@lokvis/sdk`
3. The resulting `LokvisRuntime` is stored in a Zustand store
4. All child panels (`Canvas`, `Inspector`, `HistoryPanel`, `DownloadPanel`, ...) subscribe to that store

If you need direct access to the Runtime (for example to call `runtime.run()` from a host button), use the `useLokvis()` hook:

```tsx
import { useLokvis } from '@lokvis/ui-react';

function MyHostButton() {
  const { runtime } = useLokvis({ plugins: [imageToolsPlugin()] });
  // runtime is the same LokvisRuntime instance used by <Workspace />
}
```

## Cross-origin isolation (optional, for SharedArrayBuffer)

If you later swap the Canvas engine for a WASM engine (Squoosh / ffmpeg.wasm) that uses `SharedArrayBuffer`, your deployment must serve COOP/COEP headers:

```text
# _headers (Netlify / Cloudflare Pages)
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

The bundled Canvas engine does **not** require these headers — it works on any HTTPS origin.

## Next steps

- [Build a Custom Workspace](./custom-workspace) — drop `<Workspace />` entirely and drive `@lokvis/sdk` from your own UI
- [Write Your First Plugin](./write-first-plugin) — add a custom capability to the Runtime
- [SDK reference](../sdk) — full `createLokvis` / Runtime API

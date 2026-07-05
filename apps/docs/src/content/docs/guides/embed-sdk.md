---
title: Embed the SDK
description: Embed the Lokvis Workspace into a host React 19 + Vite application using @lokvis/sdk, @lokvis/plugin-image, and @lokvis/ui-react.
draft: false
head: []
---

# Embed the SDK

This guide walks you through embedding the Lokvis Workspace into a host **React 19 + Vite** application. You will install three packages, mount the `<Workspace />` component, learn the available props, and configure COOP/COEP headers so the image engine can use `SharedArrayBuffer`.

## Prerequisites

- **Node.js** ≥ 22 LTS
- **pnpm** ≥ 9.12
- A working Vite + React 19 app (`pnpm create vite my-app --template react-ts`)
- A modern browser with `OffscreenCanvas`, `createImageBitmap`, and OPFS support (Chrome 102+ / Edge 102+ / Safari 16.4+ / Firefox 111+)

## 1. Install the packages

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image @lokvis/ui-react
```

| Package | Role |
|---|---|
| `@lokvis/sdk` | `createLokvis()` factory + `loadPlugin()` + `LokvisError` types |
| `@lokvis/plugin-image` | Official image plugin: 9 image capabilities + EXIF reader |
| `@lokvis/ui-react` | `<Workspace />` React component + `useLokvis()` hook |

`@lokvis/sdk` and `@lokvis/plugin-image` are pulled in transitively by `@lokvis/ui-react`, but installing them explicitly keeps the import paths short and the intent clear.

## 2. Minimal host app

`src/main.tsx` — standard Vite entry, nothing Lokvis-specific:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx` — mount `<Workspace />` and preload the image plugin:

```tsx
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const plugins = [imageToolsPlugin()];

export default function App() {
  return (
    <Workspace
      title="My Image Tools"
      plugins={plugins}
      showStatusBar
    />
  );
}
```

That's the entire integration. The `<Workspace />` component initializes the Runtime, wires the Redux store, mounts the Asset / Canvas / Inspector panels, and renders the pipeline bar. Plugins are passed once at module scope so they are not re-created on every render.

## 3. Workspace props

`<Workspace />` accepts the following `enable*` props to toggle subsystems on or off. All default to `true` unless noted.

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | — | Top toolbar title |
| `showStatusBar` | `boolean` | `true` | Bottom status bar (storage usage, runtime status) |
| `enableWorkflowEditor` | `boolean` | `false` | Drag-and-drop workflow editor; falls back to read-only `PipelineBar` when `false` |
| `enableCommandPalette` | `boolean` | `true` | ⌘K command palette |
| `enableCompare` | `boolean` | `true` | Before/after compare slider on the Canvas |
| `enableGlobalDropzone` | `boolean` | `true` | Full-screen drag-and-drop with MIME validation |
| `enableDownloadPanel` | `boolean` | `true` | Workflow outputs download panel |
| `enableThemeToggle` | `boolean` | `true` | Dark mode toggle |
| `enableProgressBar` | `boolean` | `true` | Progress bar + Cancel button |
| `enableErrorBanner` | `boolean` | `true` | Error banner with `LokvisError` code |
| `enableShareLink` | `boolean` | `true` | `?workflow=<base64url>` share link button |
| `plugins` | `PluginLoadEntry[]` | `[]` | Plugins loaded at runtime init |
| `lokvisOptions` | `UseLokvisOptions` | `{}` | Forwarded to `useLokvis()` (Runtime config) |

```tsx
<Workspace
  title="Minimal Tools"
  plugins={[imageToolsPlugin()]}
  enableWorkflowEditor={false}
  enableCommandPalette={false}
  enableCompare
  enableGlobalDropzone
  enableDownloadPanel
/>
```

## 4. The `useLokvis` hook

If you need direct access to the `LokvisRuntime` (e.g. to call `importAsset`, `run`, or `readAssetExif` from your own UI), use the `useLokvis()` hook instead of — or alongside — `<Workspace />`:

```tsx
import { useLokvis } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

function MyPanel() {
  const { runtime, status, error } = useLokvis({
    plugins: [imageToolsPlugin()],
    storageQuota: 1024 * 1024 * 1024, // 1 GB
    memoryBudget: 512 * 1024 * 1024,  // 512 MB
  });

  if (status === 'initializing') return <p>Loading…</p>;
  if (status === 'error') return <p>Failed: {error}</p>;
  if (!runtime) return null;

  return (
    <button onClick={() => runtime.capabilities().then(caps => console.log(caps))}>
      List capabilities
    </button>
  );
}
```

The hook guarantees a single Runtime instance per component lifetime (`initRef` guard), exposes a `idle | initializing | ready | error` status, and forwards the resulting Runtime to the Redux store via `useWorkspaceStore.init(rt)`.

## 5. COOP/COEP headers for SharedArrayBuffer

The image engine runs heavy work (decode / draw / encode) inside a Web Worker. To enable `SharedArrayBuffer` for future multi-threaded WASM engines, the host document must be **cross-origin isolated**:

### Vite dev server

In `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

### Production (Cloudflare Pages / Netlify `_headers`)

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

### Verification

Open DevTools → Console and run:

```js
console.log(typeof SharedArrayBuffer); // 'function' when COOP/COEP is applied
```

If it prints `'undefined'`, the headers are missing. Lokvis still works in this case (the Canvas engine does not require `SharedArrayBuffer`), but future WASM engines (Squoosh, ffmpeg.wasm) will be unavailable.

## 6. Run the app

```bash
pnpm dev
```

Open the printed URL, drag an image onto the Workspace, and the resize / compress / convert tools should be live.

## Next steps

- [Write your first plugin](./write-first-plugin) — declare a capability, wrap an engine operation, register it via `definePlugin()`.
- [Custom Workspace](./custom-workspace) — build a minimal workbench with only `@lokvis/sdk` (no React UI).
- [SDK reference](../sdk) — full `LokvisRuntime` API table.

---
title: Overview
description: Lokvis — Local-first Browser Workspace. Everything runs in your browser.
draft: false
head: []
---

# Lokvis

**Local-first Browser Workspace.** Everything runs in your browser. No uploads. No servers. No compromises.

## What is Lokvis?

Lokvis is an open-core platform for building file-processing tools that run entirely in the browser. Image conversion, video compression, PDF merging, audio editing — all done locally without uploading files to a server.

## Five-Layer Architecture

1. **UI Layer** — Astro 7 + React 19 + Tailwind v4
2. **Workflow Layer** — Linear workflow executor (Year 1)
3. **Runtime Layer** — Browser-local execution engine
4. **Capability Layer** — Standardized capability abstractions
5. **Engine Layer** — Pluggable engines (Canvas, Squoosh, ffmpeg.wasm, ...)

## Open Core

`lokvis-open` (MIT) provides the runtime, schema, plugins, and official UI. `lokvis-cloud` (closed-source) adds commercial services: API, Marketplace, Dashboard, Billing, Sync, AI.

## Quick Start

```bash
pnpm install
pnpm dev --filter @lokvis/web
```

## Next Steps

- [Read the Architecture guide](/docs/architecture)
- [Get started with the SDK](/docs/getting-started)
- [Browse the Capability catalog](/docs/capabilities)
- [Embed the SDK in a React app](/docs/guides/embed-sdk)
- [Write your first plugin](/docs/guides/write-first-plugin)
- [Build a custom workspace](/docs/guides/custom-workspace)
- [Automate from the CLI](/docs/guides/cli-automation)

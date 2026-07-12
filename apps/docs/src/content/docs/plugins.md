---
title: Plugins
description: Plugins are the only way to add capabilities to Lokvis.
draft: false
head: []
---

# Plugins

Plugins are the only way to add capabilities to Lokvis. A plugin declares capabilities and registers their implementations during install.

> **Repository scope ([ADR-012](https://github.com/lokvis/lokvis/blob/dev/docs/adr/012-%E5%95%86%E4%B8%9A%E8%B5%84%E4%BA%A7%E8%BF%81%E5%87%BA.md))**: the open-source (MIT) repo ships only `apps/docs/` (docs site) and `apps/playground/` (SDK/Runtime/Plugin demo). The commercial Workspace SPA and SEO tool pages have been migrated to the closed-source `lokvis-cloud` repo. Validate your plugins in `apps/playground/`.

## Anatomy of a Plugin

```typescript
import { definePlugin } from '@lokvis/plugin-sdk';
import type { Capability } from '@lokvis/schema';

const CAPABILITIES: Capability[] = [
  {
    name: 'image.resize',
    description: 'Resize image',
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [...],
    performance: 'fast',
    batchable: true,
  },
];

export default function myPlugin() {
  return definePlugin(
    {
      name: 'my-plugin',
      version: '1.0.0',
      capabilities: CAPABILITIES,
      permissions: ['asset:read', 'asset:write', 'network:none'],
    },
    (ctx) => {
      // Register capability implementations
      ctx.registerCapability({
        capability: 'image.resize',
        engine: 'my-engine',
        execute: async (inputs, params, execCtx) => {
          // ...
          return outputs;
        },
      });
    }
  );
}
```

## PluginContext API

The plugin only sees a restricted Runtime API:

- `ctx.runtime.getAsset(id)` — read asset metadata
- `ctx.runtime.getAssetBlob(asset)` — read asset blob data
- `ctx.runtime.createAsset(blob, metadata, type)` — create new asset
- `ctx.runtime.listCapabilities()` — list all capabilities
- `ctx.registerCapability(impl)` — register an implementation
- `ctx.registerPanel(panel)` — register a UI panel
- `ctx.eventBus` — emit/listen to events
- `ctx.log(level, message)` — structured logging

## Scaffold a Plugin

```bash
lokvis plugin create my-plugin
```

## Official Plugins

- `@lokvis/plugin-image` — 9 image capabilities (Canvas + createImageBitmap, real)
- `@lokvis/plugin-video` — 7 video capabilities (ffmpeg.wasm planned, stub)
- `@lokvis/plugin-pdf` — 7 PDF capabilities (pdf-lib planned, stub)
- `@lokvis/plugin-dev` — 4 developer tools (built-in, real)

Stub engines follow a uniform convention: `version` includes `'stub'`, operations throw `not implemented in stub`, and `CapabilityRegistry.resolve()` auto-skips them. The UI surfaces a "Coming Soon" badge for stub-only capabilities so users are not surprised at execution time.

## Plugin SDK vs MCP Server

Lokvis offers two extension mechanisms. Following the 2026 AI ecosystem shift (see [`AI生态冲击调整方案.md`](https://github.com/lokvis/lokvis/blob/dev/docs/AI生态冲击调整方案.md)), **MCP Server is now the recommended path** for exposing capabilities to AI clients; Plugin SDK is maintained as an Alpha preview for browser-embedding scenarios.

| Dimension | Plugin SDK | MCP Server |
|---|---|---|
| Use case | Embed Lokvis in your own web app, add custom capabilities | Let AI clients (Claude / ChatGPT / Cursor) invoke local capabilities |
| Protocol | Lokvis custom | MCP standard |
| Reach | Lokvis users only | All MCP-compatible clients |
| Priority | Alpha preview (teaching) | **Recommended** |
| Phase | Phase 1 Alpha | Phase 2 GA |

**Choose Plugin SDK when:**

- You embed Lokvis into your own website via `@lokvis/sdk` and need custom in-browser capabilities.

**Choose MCP Server when:**

- You want AI clients to process local files (compress / resize / batch / workflow).
- You want your tools reachable from Claude Desktop, Cursor, ChatGPT, or any MCP-compatible client.

See [MCP Integration](./mcp) for setup and the full tool list.


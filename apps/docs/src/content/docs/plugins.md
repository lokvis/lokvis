---
title: Plugins
description: Plugins are the only way to add capabilities to Lokvis.
draft: false
head: []
---

# Plugins

Plugins are the only way to add capabilities to Lokvis. A plugin declares capabilities and registers their implementations during install.

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

- `@lokvis/plugin-image` — 8 image capabilities (Canvas engine)
- `@lokvis/plugin-video` — 7 video capabilities (ffmpeg.wasm, stub)
- `@lokvis/plugin-pdf` — 7 PDF capabilities (pdf-lib, stub)
- `@lokvis/plugin-dev` — developer tools (real impl)

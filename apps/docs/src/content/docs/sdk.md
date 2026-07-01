---
title: SDK
description: '@lokvis/sdk is the easiest way to embed Lokvis Runtime in any web app.'
draft: false
head: []
---

# Lokvis SDK

`@lokvis/sdk` is the easiest way to embed Lokvis Runtime in any web app. It handles plugin loading and provides a clean façade over the Runtime API.

## createLokvis

```typescript
import { createLokvis } from '@lokvis/sdk';
import imageToolsPlugin from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  enableOpfs: true,
  enableIndexedDB: true,
  storageQuota: 1024 * 1024 * 1024, // 1GB
  plugins: [imageToolsPlugin()],
});
```

## Runtime API

- `lokvis.importAsset(source)` → `Promise<AssetId>`
- `lokvis.getAsset(id)` → `Promise<Asset>`
- `lokvis.exportAsset(id, format?)` → `Promise<Blob>`
- `lokvis.removeAsset(id)` → `Promise<void>`
- `lokvis.listAssets()` → `Promise<Asset[]>`
- `lokvis.run(workflow, inputs)` → `Promise<WorkflowResult>`
- `lokvis.cancel(workflowId)`
- `lokvis.capabilities()` → `Promise<Capability[]>`
- `lokvis.eventBus` — subscribe to events

## loadPlugin

Load a plugin into an existing runtime:

```typescript
import { loadPlugin } from '@lokvis/sdk';
import devToolsPlugin from '@lokvis/plugin-dev';

await loadPlugin(lokvis, devToolsPlugin());
```

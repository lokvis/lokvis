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

## Error handling

All SDK errors extend `LokvisError` with a stable `code` field for programmatic
branching. Use `fromLokvisError()` to normalize any caught value:

```typescript
import { LokvisError, fromLokvisError } from '@lokvis/sdk';

try {
  await lokvis.run(workflow, [assetId]);
} catch (e) {
  const err = fromLokvisError(e);
  if (err instanceof LokvisError) {
    switch (err.code) {
      case 'STORAGE_QUOTA_EXCEEDED':
        alert('Storage full — clean up assets');
        break;
      case 'DEGRADATION_REJECTED':
        // err.guide: user-readable suggestions
        console.warn(err.guide);
        break;
      case 'CAPABILITY_NOT_REGISTERED':
        console.warn('Install the plugin for:', err.context?.capability);
        break;
      default:
        console.error(err.code, err.message);
    }
  } else {
    throw e; // non-lokvis error, rethrow
  }
}
```

Key error codes: `ASSET_NOT_FOUND`, `WORKFLOW_INVALID`, `WORKFLOW_CYCLE`,
`CAPABILITY_NOT_REGISTERED`, `CAPABILITY_STUB_ONLY`, `STORAGE_QUOTA_EXCEEDED`,
`WORKER_CRASHED`, `WORKER_TIMEOUT`, `DEGRADATION_REJECTED`, `PLUGIN_LOAD_FAILED`.


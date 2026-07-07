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
import { imageToolsPlugin } from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  enableOpfs: true,
  enableIndexedDB: true,
  storageQuota: 1024 * 1024 * 1024, // 1GB
  plugins: [imageToolsPlugin()],
});
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableOpfs` | `boolean` | `true` | Enable OPFS storage (optimal, supports `FileSystemSyncAccessHandle`) |
| `enableIndexedDB` | `boolean` | `true` | Enable IndexedDB fallback storage (Dexie, persistent) |
| `storageQuota` | `number` | — | Storage quota (bytes); throws `QuotaExceededError` when exceeded |
| `plugins` | `Plugin[]` | `[]` | Plugin list (e.g. `imageToolsPlugin()`) |
| `auth?` | `object` | — | Cloud-injected session/token (for Pro features; the open repo does not depend on it) |
| `historyLimit?` | `number` | `10` | History stack limit (default 10 steps LRU) |
| `memoryBudget?` | `number` | `DEFAULT_MEMORY_BUDGET` | MemoryGuard memory budget (bytes) |

## Runtime API

### Asset Management

| Method | Returns | Description |
|--------|---------|-------------|
| `importAsset(source)` | `Promise<AssetId>` | Import an asset (File / Blob / URL / base64) |
| `getAsset(id)` | `Promise<Asset>` | Get asset metadata |
| `getAssetBlob(id)` | `Promise<Blob>` | Get asset Blob (read back from OPFS/IDB) |
| `exportAsset(id, format?)` | `Promise<Blob>` | Export an asset (optional format conversion) |
| `removeAsset(id)` | `Promise<void>` | Remove an asset (releases quota) |
| `listAssets()` | `Promise<Asset[]>` | List all assets |

### Workflow Execution

| Method | Returns | Description |
|--------|---------|-------------|
| `run(workflow, inputs)` | `Promise<WorkflowResult>` | Execute a workflow (5-step limit, linear) |
| `cancel(workflowId)` | `void` | Cancel execution (AbortSignal propagates to the Worker) |
| `undo()` | `Promise<AssetId \| null>` | Undo the previous step (cursor moves back) |
| `redo()` | `Promise<AssetId \| null>` | Redo (cursor moves forward) |

### Capabilities and Metadata

| Method | Returns | Description |
|--------|---------|-------------|
| `capabilities()` | `Promise<Capability[]>` | List registered capabilities |
| `listCapabilities()` | `Promise<Capability[]>` | Same as above (alias) |
| `readAssetMetadata(id)` | `Promise<ExifData>` | Read EXIF metadata (provided by plugin-image) |
| `toMcpManifest(options?)` | `McpManifest` | Generate MCP server manifest |
| `eventBus` | `EventBus` | Event bus (subscribe / publish) |

### Event Bus

```typescript
lokvis.eventBus.on('asset:imported', (e) => console.log('Imported:', e.assetId));
lokvis.eventBus.on('workflow:started', (e) => console.log('Started:', e.workflowId));
lokvis.eventBus.on('workflow:completed', (e) => console.log('Done:', e.elapsedMs));
lokvis.eventBus.on('history:changed', (e) => console.log('History:', e.action));
lokvis.eventBus.on('memory:pressure', (e) => console.log('Pressure:', e.level));

// One-time
lokvis.eventBus.once('workflow:completed', handler);

// Unsubscribe
const off = lokvis.eventBus.on('asset:imported', handler);
off();
```

## loadPlugin

Dynamically load a plugin into an already-created Runtime:

```typescript
import { loadPlugin } from '@lokvis/sdk';
import { devToolsPlugin } from '@lokvis/plugin-dev';

await loadPlugin(lokvis, devToolsPlugin());
```

## WorkflowBuilder

`@lokvis/runtime` provides a `WorkflowBuilder` chain API to construct workflows:

```typescript
import { WorkflowBuilder } from '@lokvis/runtime';

const workflow = new WorkflowBuilder({ name: 'Web Optimize', category: 'web' })
  .setInput({ type: 'image/*' })
  .add('image.resize', { width: 1920, height: 1080, fit: 'inside' })
  .add('image.compress', { quality: 80 })
  .add('image.convert', { format: 'webp' })
  .setOutput({ type: 'image/webp', label: 'optimized' })
  .build(); // validate + output Workflow object

// Chain operations
builder.move('n1', 'n2');      // move node
builder.swap('n1', 'n2');      // swap
builder.updateParams('n1', { width: 1280 });
builder.remove('n1');           // remove (auto-reconnect edges)
```

Throws `WorkflowValidationError` when the 5-step limit is exceeded.

## Pro Feature Gating

```typescript
// The runtime.isPro flag affects:
// - Batch processing limit (free: 10 / Pro: unlimited)
// - Workflow slots (free: 5 / Pro: unlimited)
// - Custom presets count (free: 3 / Pro: unlimited)
// - Advanced formats (AVIF/JXL, Phase 2)
```

The Pro flag is injected by Cloud (`auth.session`); the open repo is always in free mode.

## MCP Manifest API

```typescript
const manifest = lokvis.toMcpManifest({
  includeStubCapabilities: false, // exclude stub capabilities by default
});

console.log(manifest.tools);
// [
//   {
//     name: 'lokvis_image_resize',
//     description: '...',
//     inputSchema: { ... },
//     capabilities: ['image.resize']
//   },
//   ...
// ]

console.log(manifest.resources);
// [
//   { uri: 'lokvis://capabilities', name: 'Capabilities', ... },
//   { uri: 'lokvis://workflows', name: 'Workflows', ... }
// ]
```

Use cases:
1. Capability discovery before an MCP server registers tools
2. Dashboard display of "capabilities invocable by AI"
3. Auto-generate the tool list for the docs site

## Error handling

All SDK errors extend `LokvisError` with a stable `code` field for programmatic
branching. Use `fromLokvisError()` to normalize any caught value:

```typescript
import {
  DegradationRejectedError,
  fromLokvisError,
} from '@lokvis/sdk';

try {
  await lokvis.run(workflow, [assetId]);
} catch (e) {
  // fromLokvisError() always returns a LokvisError (including normalizing
  // non-lokvis values into code: 'UNKNOWN'), so an `instanceof LokvisError`
  // guard is no longer needed here.
  const err = fromLokvisError(e);
  switch (err.code) {
    case 'STORAGE_QUOTA_EXCEEDED':
      alert('Storage full — clean up assets');
      break;
    case 'DEGRADATION_REJECTED':
      // The guide field only exists on DegradationRejectedError; narrow
      // the type with instanceof.
      if (err instanceof DegradationRejectedError) {
        // err.guide: user-readable suggestions
        console.warn(err.guide);
      }
      break;
    case 'CAPABILITY_NOT_REGISTERED':
      console.warn('Install the plugin for:', err.context?.capability);
      break;
    case 'UNKNOWN':
      // Errors that remain unrecognized after normalization: rethrow or report as needed
      throw e;
    default:
      console.error(err.code, err.message);
  }
}
```

### Error codes

| Code | Description | Trigger |
|------|-------------|---------|
| `ASSET_NOT_FOUND` | Asset does not exist | Not found by `getAsset(id)` / `exportAsset(id)` |
| `WORKFLOW_INVALID` | Workflow JSON validation failed | Validates empty nodes / input-output / capability compatibility before `run()` |
| `WORKFLOW_CYCLE` | Workflow contains a cycle (Phase 1 is linear; should not trigger) | `validateWorkflow()` |
| `CAPABILITY_NOT_REGISTERED` | Capability not registered | Corresponding plugin not loaded |
| `CAPABILITY_STUB_ONLY` | Only a stub implementation available | Video/PDF/Audio engines not integrated (Phase 2) |
| `STORAGE_QUOTA_EXCEEDED` | Storage quota exceeded | OPFS/IDB full; `checkStorageQuota()` before `run()` |
| `WORKER_CRASHED` | Worker crashed and restart failed | Heartbeat timeout + restarts reach `maxRestarts` (default 3) |
| `WORKER_TIMEOUT` | Worker request timed out | Single request exceeds 60s (default) |
| `DEGRADATION_REJECTED` | Memory critical and cannot degrade | L4 rejection; carries `guide` user suggestions |
| `PLUGIN_LOAD_FAILED` | Plugin load failed | Plugin install throws |
| `BATCH_LIMIT_EXCEEDED` | Batch exceeds free limit | 10 items free / Pro unlimited |
| `UNKNOWN` | Still unrecognized after normalization | Non-lokvis error |

## CLI

`@lokvis/cli` provides terminal access:

```bash
pnpm add -g @lokvis/cli

lokvis run ./my-workflow.json ./input.png  # execute workflow
lokvis capabilities                         # list registered capabilities
lokvis plugin create my-plugin              # scaffold a new plugin
lokvis mcp                                  # start MCP server (stdio)
lokvis version
lokvis help
```

> Note: Capabilities that depend on browser APIs (Canvas / createImageBitmap) cannot run in Node.js; `lokvis run` only applies to workflows that do not depend on the browser.

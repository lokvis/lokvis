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
| `enableOpfs` | `boolean` | `true` | Enable OPFS storage (best, supports `FileSystemSyncAccessHandle`) |
| `enableIndexedDB` | `boolean` | `true` | Enable IndexedDB fallback storage (Dexie, persistent) |
| `storageQuota` | `number` | — | Storage quota in bytes; throws `QuotaExceededError` when exceeded |
| `plugins` | `Plugin[]` | `[]` | List of plugins (e.g. `imageToolsPlugin()`) |
| `auth?` | `object` | — | Cloud-injected session/token (for Pro features; the open repo does not depend on it) |
| `historyLimit?` | `number` | `10` | History stack limit (default 10-step LRU) |
| `memoryBudget?` | `number` | `DEFAULT_MEMORY_BUDGET` | MemoryGuard memory budget in bytes |

## Runtime API

> Source: [`LokvisRuntime` interface](https://github.com/lokvis/lokvis/blob/main/packages/runtime/src/types.ts). The table below is aligned with the interface.
> Note: `getAssetBlob` is only available inside [PluginContext](plugins.md#plugin-context) (plugins read asset Blobs internally); the public Runtime does not expose it — consumers should use `exportAsset(id, format?)` to get a Blob.

| Method | Returns | Description |
|--------|---------|-------------|
| `version` | `string` (readonly property) | Runtime version |
| `status` | `RuntimeStatus` (readonly property) | Current status |
| `eventBus` | `EventBus` (readonly property) | Event bus (subscribe / publish) |
| `isPro` | `boolean` (readonly property) | Whether Pro mode is active (affects batch limit / concurrency slots / workflow count) |
| `batch` | `BatchProcessor` (readonly property) | Batch processor (concurrency control + progress + retry) |
| `importAsset(source)` | `Promise<AssetId>` | Import an asset (File / Blob / URL / base64) |
| `getAsset(id)` | `Promise<Asset>` | Get asset metadata |
| `exportAsset(id, format?)` | `Promise<Blob>` | Export an asset (with optional format conversion) |
| `removeAsset(id)` | `Promise<void>` | Delete an asset (reclaims quota) |
| `listAssets()` | `Promise<Asset[]>` | List all assets |
| `readAssetExif(id)` | `Promise<ExifData \| null>` | Read EXIF metadata of an image asset (returns null for non-image / no EXIF / no reader registered) |
| `run(workflow, inputs, options?)` | `Promise<WorkflowResult>` | Execute a workflow (optional RunOptions: `appendHistory`) |
| `cancel(workflowId)` | `Promise<void>` | Cancel execution (AbortSignal flows through to the Worker) |
| `pause(workflowId)` | `Promise<void>` | Pause execution |
| `resume(workflowId)` | `Promise<void>` | Resume execution |
| `getCurrentOutputs(workflowId)` | `Promise<AssetId[]>` | Get the workflow's current output AssetIds (the "current" state after undo/redo) |
| `disposeWorkflow(workflowId)` | `Promise<void>` | Dispose workflow runtime state (cancel run + clear history stack + reclaim history output assets) |
| `history(workflowId)` | `Promise<HistoryEntry[]>` | Get the workflow execution history |
| `getHistoryState(workflowId)` | `Promise<{ entries: HistoryEntry[]; cursor: number }>` | Get history state (cursor -1 means no applied entries) |
| `undo(workflowId)` | `Promise<void>` | Undo one step |
| `redo(workflowId)` | `Promise<void>` | Redo one step |
| `jumpTo(workflowId, index)` | `Promise<void>` | Jump to a specific history entry (by chronological index, -1 resets to initial; out-of-range or unchanged cursor is a no-op) |
| `capabilities()` | `Promise<Capability[]>` | List registered capabilities |
| `hasCapability(name)` | `Promise<boolean>` | Check if a capability is available |
| `isStubOnly(name)` | `Promise<boolean>` | Check if a capability has only stub implementations (UI shows "Coming Soon") |
| `getStorageUsage()` | `Promise<{ usage: number; quota: number }>` | Get storage usage (used / quota, in bytes) |
| `toMcpManifest(options?)` | `McpManifest` (sync) | Generate an MCP server manifest (`options.batchMode` controls whether batch-only capabilities are exposed; private ones are never exposed) |
| `installPlugin(plugin)` | `Promise<void>` | Install a plugin (register capabilities → build PluginContext → call plugin.install → emit `plugin:loaded` event; throws PluginLoadError on failure) |

### Event Bus

```typescript
lokvis.eventBus.on('asset:imported', (e) => console.log('Imported:', e.assetId));
lokvis.eventBus.on('workflow:started', (e) => console.log('Started:', e.workflowId));
lokvis.eventBus.on('workflow:completed', (e) => console.log('Done:', e.elapsedMs));
lokvis.eventBus.on('history:changed', (e) => console.log('History:', e.action));
lokvis.eventBus.on('memory:pressure', (e) => console.log('Pressure:', e.level));

// One-shot
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

`@lokvis/workflow` provides the `WorkflowBuilder` chainable API to construct workflows:

```typescript
import { WorkflowBuilder } from '@lokvis/workflow';

const workflow = new WorkflowBuilder({ id: 'wf_001', name: 'Web Optimize' })
  .setInput({ type: 'image', multiple: true })
  .setOutput({ type: 'image', format: 'webp' })
  .add('image.resize', { width: 1920, height: 1080, fit: 'inside' })
  .add('image.compress', { quality: 80 })
  .add('image.convert', { format: 'webp' })
  .build(); // Validate + output the Workflow object

// Chainable operations (during construction)
builder.move(0, 2);                       // Move node (by index)
builder.swap(0, 1);                       // Swap (by index)
builder.updateParams('wf_001-node-1', { width: 1280 });
builder.remove('image.convert');          // Remove (auto-reconnects edges)
```

Constructor `WorkflowBuilderOptions` requires `id` + `name`; `setInput` / `setOutput` are required (calling `build()` without them throws).

The 5-step limit (`MAX_WORKFLOW_STEPS`) is enforced in `add()` — exceeding it throws `Error` immediately.

## Pro Feature Gating

```typescript
// The runtime.isPro flag affects:
// - Batch processing limit (free 10 / Pro unlimited)
// - Workflow slots (free 5 / Pro unlimited)
// - Custom presets (free 3 / Pro unlimited)
// - Advanced formats (AVIF/JXL, Phase 2)
```

The Pro flag is injected by the Cloud (`auth.session`); the open repo is always in free mode.

## MCP Manifest API

```typescript
const manifest = lokvis.toMcpManifest({
  includeStubCapabilities: false, // Exclude stub capabilities by default
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
1. Capability probing before the MCP server registers tools
2. A dashboard showing "capabilities callable by AI"
3. Auto-generating the tool list for the docs site

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
  // fromLokvisError() always returns a LokvisError (it also normalizes
  // non-lokvis values to code: 'UNKNOWN'), so you no longer need an
  // `instanceof LokvisError` guard here.
  const err = fromLokvisError(e);
  switch (err.code) {
    case 'STORAGE_QUOTA_EXCEEDED':
      alert('Storage full — clean up assets');
      break;
    case 'DEGRADATION_REJECTED':
      // The guide field only exists on DegradationRejectedError; use instanceof to narrow the type.
      if (err instanceof DegradationRejectedError) {
        // err.guide: user-readable suggestions
        console.warn(err.guide);
      }
      break;
    case 'CAPABILITY_NOT_REGISTERED':
      console.warn('Install the plugin for:', err.context?.capability);
      break;
    case 'UNKNOWN':
      // An error that is still unidentifiable after normalization: rethrow or report as needed
      throw e;
    default:
      console.error(err.code, err.message);
  }
}
```

### Error codes

| Code | Description | Trigger |
|------|-------------|---------|
| `ASSET_NOT_FOUND` | Asset ID does not exist | `getAsset(id)` / `exportAsset(id)` not found |
| `ASSET_BLOB_NOT_FOUND` | Asset Blob data missing | OPFS/IDB data lost, needs re-import |
| `ASSET_IMPORT_FAILED` | Asset import failed | Unsupported format / IO error |
| `ASSET_EXPORT_FAILED` | Asset export failed | Unsupported format / encoding error |
| `WORKFLOW_INVALID` | Workflow JSON validation failed | Pre-`run()` validation of empty nodes / inputs-outputs / capability compatibility |
| `WORKFLOW_CYCLE` | Workflow contains a cycle (Phase 1 is linear, should not trigger) | `validateWorkflow()` |
| `WORKFLOW_NODE_ERROR` | Workflow node execution failed | Carries nodeId / capability |
| `CAPABILITY_NOT_REGISTERED` | Capability not registered | Corresponding plugin not loaded |
| `CAPABILITY_STUB_ONLY` | Only a stub implementation exists | Video/PDF/Audio engines not wired up (Phase 2) |
| `STORAGE_QUOTA_EXCEEDED` | Storage quota exceeded | OPFS/IDB full; `checkStorageQuota()` before `run()` |
| `STORAGE_OPFS_UNAVAILABLE` | OPFS unavailable | Degrades to IndexedDB |
| `STORAGE_IDB_UNAVAILABLE` | IndexedDB unavailable | Degrades to in-memory |
| `WORKER_CRASHED` | Worker crashed and restart failed | Heartbeat timeout + restarts reached `maxRestarts` (default 3) |
| `WORKER_TIMEOUT` | Worker request timed out | Single request exceeded 60s (default) |
| `WORKER_DEAD` | Worker entered dead state | Exceeded `maxRestarts` |
| `WORKER_REQUEST_ABORTED` | Worker request cancelled | AbortController triggered |
| `WORKER_HANDSHAKE_FAILED` | Worker handshake failed | Protocol version mismatch |
| `DEGRADATION_REJECTED` | Memory critical and not degradable | L4 reject, carries `guide` user suggestions |
| `PLUGIN_LOAD_FAILED` | Plugin load failed | plugin install threw |
| `UNKNOWN` | Still unidentifiable after normalization | Non-lokvis error |

## CLI

`@lokvis/cli` provides terminal access:

```bash
pnpm add -g @lokvis/cli

lokvis run ./my-workflow.json ./input.png  # Run a workflow
lokvis capabilities                         # List registered capabilities
lokvis plugin create my-plugin              # Scaffold a new plugin
lokvis mcp                                  # Start an MCP server (stdio)
lokvis version
lokvis help
```

> Note: Capabilities that depend on browser APIs (Canvas / createImageBitmap) cannot run in Node.js, so `lokvis run` only applies to workflows that don't depend on the browser.

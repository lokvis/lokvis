# @lokvis/sdk

> Embed Lokvis Runtime in any web app — local-first image/video/PDF processing.

`@lokvis/sdk` is the easiest way to use Lokvis. It wraps `@lokvis/runtime` with a clean façade: plugin loading, asset management, workflow execution, and error handling — all running in the browser.

## Install

```bash
pnpm add @lokvis/sdk @lokvis/plugin-image
# peer: react / react-dom only needed if you use @lokvis/ui-react
```

## Quick start

```ts
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
});

// Import a file → run a workflow → export the result
const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(workflow, [assetId]);
const blob = await lokvis.exportAsset(result.outputs[0]);
```

## API

### Functions

| Function | Signature | Description |
|---|---|---|
| `createLokvis` | `(options?: CreateLokvisOptions) => Promise<LokvisRuntime>` | Initialize Runtime + preload plugins |
| `loadPlugin` | `(runtime, plugin) => Promise<void>` | Load a single plugin into an existing runtime |
| `fromLokvisError` | `(value: unknown) => LokvisError` | Normalize any caught value into a `LokvisError` |

### LokvisRuntime methods

| Method | Returns | Description |
|---|---|---|
| `importAsset(source)` | `Promise<AssetId>` | Import a file/blob/url as an asset |
| `getAsset(id)` | `Promise<Asset>` | Get asset metadata |
| `exportAsset(id, format?)` | `Promise<Blob>` | Export an asset as a Blob |
| `removeAsset(id)` | `Promise<void>` | Delete an asset |
| `listAssets()` | `Promise<Asset[]>` | List all stored assets |
| `run(workflow, inputs)` | `Promise<WorkflowResult>` | Execute a workflow |
| `cancel(workflowId)` | `void` | Cancel a running workflow |
| `pause(workflowId)` / `resume(workflowId)` | `void` | Pause / resume |
| `capabilities()` | `Promise<Capability[]>` | List registered capabilities |
| `eventBus` | `EventBus` | Subscribe to runtime events |
| `toMcpManifest(options?)` | `McpManifest` | Generate MCP tool manifest (AI integration) |

### Error handling

All SDK errors extend `LokvisError` with a stable `code` field:

```ts
import { createLokvis, LokvisError, fromLokvisError } from '@lokvis/sdk';

try {
  await lokvis.run(workflow, [assetId]);
} catch (e) {
  const err = fromLokvisError(e);
  if (err instanceof LokvisError) {
    switch (err.code) {
      case 'STORAGE_QUOTA_EXCEEDED':
        console.warn('Storage full — clean up assets');
        break;
      case 'CAPABILITY_NOT_REGISTERED':
        console.warn('Plugin missing:', err.context?.capability);
        break;
      case 'DEGRADATION_REJECTED':
        console.warn('Image too large:', err.guide);
        break;
      default:
        console.error(err.code, err.message);
    }
  }
}
```

#### Error codes

| Code | Class | When |
|---|---|---|
| `ASSET_NOT_FOUND` | `AssetNotFoundError` | Asset ID doesn't exist |
| `ASSET_IMPORT_FAILED` | `AssetImportError` | Import failed (corrupt file, etc.) |
| `WORKFLOW_INVALID` | `WorkflowInvalidError` | Workflow schema validation failed |
| `WORKFLOW_CYCLE` | `WorkflowCycleError` | Workflow contains a cycle |
| `CAPABILITY_NOT_REGISTERED` | `CapabilityNotRegisteredError` | No plugin provides this capability |
| `CAPABILITY_STUB_ONLY` | `CapabilityStubOnlyError` | Only stub engine registered |
| `STORAGE_QUOTA_EXCEEDED` | `StorageQuotaExceededError` | Storage quota exceeded |
| `WORKER_CRASHED` | `WorkerCrashedError` | Worker process crashed |
| `WORKER_TIMEOUT` | `WorkerTimeoutError` | Worker request timed out |
| `DEGRADATION_REJECTED` | `DegradationRejectedError` | Memory budget exceeded (L4 reject) |
| `PLUGIN_LOAD_FAILED` | `PluginLoadError` | Plugin install threw |
| `UNKNOWN` | `LokvisError` | Catch-all |

## Examples

See the `examples/` directory at the repo root:

- **`examples/custom-workspace`** — Build a custom UI with only `@lokvis/sdk` (no `@lokvis/ui-react`)
- **`examples/embedding`** — Embed `<Workspace />` into an existing React app
- **`examples/cli-automation`** — Programmatic CLI usage in Node.js scripts

## License

MIT

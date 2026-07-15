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

## Cloud auth & Pro gate (W17.3)

`createLokvis` accepts an optional `auth` option to receive cloud session/token
from your auth layer. When present (and not explicitly `isPro: false`), the
runtime flips to **Pro mode**: batch processing has no item limit, default
concurrency rises from 4 → 16, and UI workflow slots become unlimited.

```ts
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

// After your cloud login flow returns a JWT:
const cloudJwt = await fetchCloudSession(oauthCode);

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
  auth: { session: cloudJwt },
});

console.log(lokvis.isPro); // true → batch enqueue > 10 items no longer throws
```

`LokvisAuthSession` shape:

| Field | Type | Description |
|---|---|---|
| `session` | `string` | Cloud session token (e.g. JWT from lokvis-cloud) |
| `token` | `string` | Direct API token (alternative to `session`, for CLI / server) |
| `isPro` | `boolean` | Explicit override. Wins over `session`/`token` presence. |

Resolution rules:

1. No `auth` → `isPro = false` (free mode, default)
2. `auth.isPro` explicitly set → use it (allows guest sessions with `isPro: false`)
3. Otherwise → `session` or `token` non-empty → `isPro = true`

SDK does **not** validate token shape or signature — that's the cloud gateway's
job. SDK only consumes the result.

### Migration (0.2.x → 0.3.x)

- **Local-only usage**: no change required. `createLokvis()` with no `auth`
  keeps `isPro = false` and free-tier limits, identical to 0.2.x.
- **Direct `isPro` flag still works**: `createLokvis({ isPro: true })`
  (the RuntimeConfig path) remains valid for testing / dev.
- **Cloud integration**: add the `auth` option in your cloud-aware bootstrap
  path. Free-tier users should be given an empty/undefined `auth` (or
  `auth: { session, isPro: false }` if you issue guest sessions).

| Behavior | free (`isPro=false`) | Pro (`isPro=true`) |
|---|---|---|
| `batch.enqueue` item limit | 10 (throws `BatchLimitExceededError`) | unlimited |
| `batch.enqueue` default concurrency | 4 | 16 |
| UI workflow slots | 5 | unlimited |
| Playground custom presets | 3 | unlimited |

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
| `ASSET_IMPORT_FAILED` | `AssetImportError` | Import failed (corrupt file, fetch error) |
| `ASSET_EXPORT_FAILED` | `AssetExportError` | Export failed (blob not found, encode error) |
| `WORKFLOW_INVALID` | `WorkflowInvalidError` | Workflow schema validation failed (duplicate node id, etc.) |
| `WORKFLOW_CYCLE` | `WorkflowCycleError` | Workflow contains a cycle |
| `WORKFLOW_NODE_ERROR` | `WorkflowNodeError` | Node execution failed (missing capability, etc.) |
| `CAPABILITY_NOT_REGISTERED` | `CapabilityNotRegisteredError` | No plugin provides this capability |
| `CAPABILITY_STUB_ONLY` | `CapabilityStubOnlyError` | Only stub engine registered |
| `STORAGE_QUOTA_EXCEEDED` | `StorageQuotaExceededError` | Storage quota exceeded |
| `STORAGE_OPFS_UNAVAILABLE` | `StorageOpfsUnavailableError` | OPFS not supported or permission denied |
| `STORAGE_IDB_UNAVAILABLE` | `StorageIdbUnavailableError` | IndexedDB unavailable (private mode, etc.) |
| `WORKER_CRASHED` | `WorkerCrashedError` | Worker process crashed or restarting |
| `WORKER_TIMEOUT` | `WorkerTimeoutError` | Worker request timed out |
| `WORKER_DEAD` | `WorkerDeadError` | Worker exceeded max restarts, unrecoverable |
| `WORKER_REQUEST_ABORTED` | `WorkerRequestAbortedError` | Request aborted via AbortSignal |
| `WORKER_HANDSHAKE_FAILED` | `WorkerHandshakeError` | Worker ready handshake failed (timeout / protocol mismatch) |
| `DEGRADATION_REJECTED` | `DegradationRejectedError` | Memory budget exceeded (L4 reject) |
| `PLUGIN_LOAD_FAILED` | `PluginLoadError` | Plugin install threw |
| `UNKNOWN` | `LokvisError` | Catch-all for unrecognized errors |

> **Note**: `fromLokvisError()` normalizes both typed runtime errors (via `instanceof`) and
> untyped `Error` throws (via best-effort message matching) into the corresponding class above.
> Always run caught values through `fromLokvisError()` before switching on `code`.

## Examples

See the `examples/` directory at the repo root:

- **`examples/custom-workspace`** — Build a custom UI with only `@lokvis/sdk` (no `@lokvis/ui-react`)
- **`examples/embedding`** — Embed `<Workspace />` into an existing React app
- **`examples/cli-automation`** — Programmatic CLI usage in Node.js scripts

## License

MIT

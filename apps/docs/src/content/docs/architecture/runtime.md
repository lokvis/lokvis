---
title: Runtime Layer (Deep Dive)
description: Internal structure of @lokvis/runtime — the browser-local execution engine.
draft: false
head: []
---

# Runtime Layer (Deep Dive)

The Runtime is the "browser operating system" of Lokvis. Its single responsibility is **`Input → Run → Output`** — it never renders UI, never knows about specific engines (FFmpeg / Squoosh), and never talks to the network except when you explicitly fetch a URL-imported asset.

This page documents the internal module structure of [`@lokvis/runtime`](https://github.com/lokvis/lokvis/tree/dev/packages/runtime/src). For the high-level overview and sequence diagrams, see [Architecture](../architecture).

## Module map

```
packages/runtime/src/
├── runtime.ts             ← LokvisRuntimeImpl + createRuntime factory
├── types.ts               ← Public types (LokvisRuntime, RuntimeConfig, ...)
├── event-bus.ts           ← Typed event bus (mitt-backed)
├── asset-store.ts         ← AssetStore interface + createAssetStore factory
├── opfs-asset-store.ts    ← OPFS backend (preferred)
├── idb-asset-store.ts     ← IndexedDB backend (Dexie fallback)
├── capability-registry.ts ← Capability declarations + implementations
├── executor.ts            ← WorkflowExecutor (linear DAG runner)
├── workflow-builder.ts    ← WorkflowBuilder chain API + MAX_WORKFLOW_STEPS
├── history.ts             ← HistoryStack (cursor + LRU)
├── history-store.ts       ← IDB persistence for HistoryStack snapshots
├── memory-guard.ts        ← MemoryGuard (4-level pressure + OPFS spill)
├── degradation.ts         ← pickDegradation pure function (L1-L4 ladder)
├── batch-processor.ts     ← BatchProcessor (concurrency pool + retry)
├── worker-host.ts         ← WorkerHost state machine
└── worker-protocol.ts     ← JSON message protocol (host ↔ worker)
```

Each module is self-contained and unit-tested (`src/__tests__/<module>.test.ts`). Cross-module wiring happens only inside `LokvisRuntimeImpl`.

## The `LokvisRuntime` contract

The public surface is the `LokvisRuntime` interface in [types.ts](https://github.com/lokvis/lokvis/blob/dev/packages/runtime/src/types.ts). It groups into five areas:

| Area | Methods |
|------|---------|
| Asset lifecycle | `importAsset` / `getAsset` / `getAssetBlob` / `exportAsset` / `removeAsset` / `listAssets` / `getStorageUsage` |
| Workflow execution | `run` / `cancel` / `pause` / `resume` / `disposeWorkflow` |
| History | `history` / `getHistoryState` / `undo` / `redo` / `jumpTo` / `getCurrentOutputs` |
| Capability discovery | `capabilities` / `hasCapability` |
| MCP bridge | `toMcpManifest` |

Plus three properties: `version`, `isPro`, `eventBus`, `batch` (the `BatchProcessor`).

The interface is what `@lokvis/sdk` returns from `createLokvis()` and what `@lokvis/ui-react` consumes via the `useLokvis()` hook. Plugins see a **restricted** view (`PluginContext`) — never the full Runtime.

## Construction

`createRuntime(config)` is the only public factory. It is `async` because the AssetStore auto-detection probes OPFS / IndexedDB:

```typescript
export async function createRuntime(config?: RuntimeConfig): Promise<LokvisRuntime> {
  const assetStore = config?.assetStore ?? (await createAssetStore({ preferOpfs: ... }));
  const historyStore = config?.historyStore ?? (enableIndexedDB ? createHistoryStore(...) : undefined);
  const impl = new LokvisRuntimeImpl({ ...config, assetStore, historyStore });
  await impl.loadPersistedHistory();   // restore undo/redo across sessions
  return impl;
}
```

`loadPersistedHistory()` runs once at construction to restore any persisted `HistoryStack` snapshots from IndexedDB. The SDK's `createLokvis()` wraps this with plugin loading and error normalization.

## The five subsystems

### 1. AssetStore (storage)

`AssetStore` is an interface (`import` / `get` / `getBlob` / `remove` / `list` / `create`). Three backends implement it:

- **`OpfsAssetStore`** — preferred. Uses async `FileSystemFileHandle` on the Origin Private File System. Best for large blobs.
- **`IdbAssetStore`** — fallback. Dexie-backed IndexedDB; persists across sessions.
- **`MemoryAssetStore`** — final fallback. In-memory `Map`; does not persist.

`createAssetStore({ preferOpfs })` probes OPFS → IndexedDB → Memory in order and falls back automatically. The Runtime wraps every backend with `wrapAssetStoreWithQuota()` to enforce `storageQuota` (default 1 GB) — imports that would exceed the quota throw `QuotaExceededError` before any bytes are written.

The Runtime only ever holds **`AssetId`** strings, never raw `Blob`s. Blobs are read on demand via `getAssetBlob(handle)` and released for GC.

### 2. CapabilityRegistry (capabilities)

A `Map<CapabilityName, { capability, implementations[] }>`. Plugins call `ctx.registerCapability(impl)` (forwarded to `registry.registerImplementation(impl)`) during their `install()` phase.

`resolve(name, preferredEngine?)` filters out `status === 'stub'` implementations and picks one of the surviving ones via the configured `EngineSelectionStrategy`:

- `'first'` (default) — first registered
- `'fastest'` — pick the one whose `performance` is best (fast > medium > slow)
- `'balanced'` — prefer one whose performance matches the capability declaration

Workflows call `resolve()` per node before executing — if no non-stub implementation is registered, the workflow fails fast with `CAPABILITY_STUB_ONLY`.

### 3. WorkflowExecutor (workflow)

`WorkflowExecutor` takes a validated `Workflow` and runs its `transform` nodes in topological order (`load` / `export` nodes are markers, skipped by the executor). For each transform node:

1. Look up the `CapabilityImplementation` via `capabilityRegistry.resolve(node.capability)`
2. Pull input blobs from `AssetStore`
3. Call `impl.execute(inputs, node.params, execCtx)` where `execCtx` carries `signal` (AbortSignal) and `onProgress`
4. Persist the output blobs via `AssetStore.create()`
5. Emit `node:finished` (with `outputs`, `params`, `capability`)

The executor never knows about React, plugins, or specific engines. It speaks only `Asset`, `Capability`, and `Workflow`.

### 4. HistoryStack (undo/redo)

Each workflow gets its own `HistoryStack` (capped at `MAX_CONCURRENT_WORKFLOW_STACKS = 32` to avoid leaks from long sessions). The stack is a cursor-based structure:

- `append(entry)` — push and truncate any redo branch (cursor → new entry)
- `undo()` — move cursor back, return the entry (or `null` if back to initial state)
- `redo()` — move cursor forward
- `jumpTo(index)` — random access

`onEvict` callback fires when LRU evicts an entry — the Runtime uses it to `assetStore.remove()` the evicted outputs (no OPFS leak). `onChanged` fires on every mutation — the Runtime forwards it as a `history:changed` event and triggers `persistHistory()`.

The Runtime listens to `node:finished` events from the executor and auto-appends a `HistoryEntry` per finished transform. This is why callers don't need to manage history manually.

`HistoryStore` (IDB-backed) persists `{ entries, cursor, initialInputs, currentOutputs }` per workflow, enabling undo/redo across browser refreshes. `loadPersistedHistory()` restores them at construction.

### 5. MemoryGuard + Degradation (memory defense)

`MemoryGuard` tracks in-flight decoded bytes via explicit `track(bytes)` / `release()` calls (not `performance.memory`). It exposes a 4-level pressure scale (`low` / `elevated` / `high` / `critical`) computed from `tracked / budget`.

`pickDegradation(ctx)` is a pure function that decides:

| Level | Trigger | Strategy |
|-------|---------|----------|
| L1-full | `low` or `elevated` | Run as-is |
| L2-tiled | `high` + operation supports tiling | Tile-based + OPFS spill of intermediate blobs |
| L3-degraded | `high` (no tiling) or `critical` | Cap output to `maxEdge=4096`, quality=70 |
| L4-reject | `critical` and even degraded won't fit | Throw `DegradationRejectedError` with `guide[]` |

`BatchProcessor` consumes `memoryGuard.getPressure()` to dynamically shrink its concurrency pool — under `high` pressure, free concurrency slots are not refilled.

## Worker isolation

Heavy compute (Canvas image operations, future WASM) runs in a dedicated Web Worker to keep the main thread responsive. The protocol is pure JSON, split by direction:

- **Host → Worker**: `request` (with `id`), `ping` (heartbeat), `cancel` (abort in-flight)
- **Worker → Host**: `response` (correlated by `id`), `pong`, `event` (progress), `ready` (handshake), `error` (fatal)

`WorkerHost` manages the lifecycle: ready handshake → heartbeat → request/response → crash-restart (up to `maxRestarts=3`). After 3 failed restarts it enters `dead` state and surfaces to the caller — never silently swallows failures.

The transport layer (`WorkerTransport` interface) abstracts browser Workers vs. test fakes, so the protocol and restart logic are unit-testable in Node.

See [Architecture: Worker Isolation](../architecture#worker-隔离worker-isolation) for the sequence and state diagrams.

## Public versioning

```typescript
export const RUNTIME_VERSION = '0.1.0';
```

Workflow schema is `v1` (used by share links `?workflow=<base64url>` as `{v:1, nodes:[...]}`). Worker protocol version is exchanged in the `ready` handshake — the host rejects mismatched workers.

## Extension points

The Runtime exposes four "internal" hooks prefixed with `_` (underscore = not part of the public `LokvisRuntime` interface, used by the Plugin SDK):

| Hook | Caller | Purpose |
|------|--------|---------|
| `_getAssetStore()` | plugin-sdk | Let plugins persist new blobs via `AssetStore.create()` |
| `_getCapabilityRegistry()` | plugin-sdk | Register capability declarations + implementations |
| `_getMemoryGuard()` | integration tests | Drive memory pressure to test `BatchProcessor` shrinkage |
| `_registerMetadataReader(name, fn)` | plugin-sdk | Register a `MetadataReader` (e.g. EXIF) |

`getCurrentOutputs(workflowId)` is the only public read-side hook — UI / MCP use it to fetch the post-undo/redo "current" outputs without re-running.

## What the Runtime explicitly does NOT do

- Render UI (no React, no DOM)
- Know about FFmpeg / Squoosh / pdf-lib (only about capabilities)
- Persist credentials or talk to a server (except user-initiated URL imports)
- Implement pixel operations (those live in `engine-image` and are invoked via plugins)
- Enforce Pro limits at the boundary (delegated to `BatchProcessor` and `useWorkflows`)

This separation is what makes the Runtime embeddable in any host (browser extension, Electron, iframe) and testable in pure Node with fake stores.

## Further reading

- [Engine Layer](./engine) — the pixel operations the Runtime invokes
- [Capability Layer](./capability) — how capabilities are declared and resolved
- [Plugin Layer](./plugin) — how plugins wire engines into the Runtime
- [Architecture overview](../architecture) — high-level diagrams and sequence flows

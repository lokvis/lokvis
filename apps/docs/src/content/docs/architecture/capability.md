---
title: Capability Layer (Deep Dive)
description: The <domain>.<action> naming convention, capability registry, and resolution flow.
draft: false
head: []
---

# Capability Layer (Deep Dive)

A **capability** is the standardized abstraction that lets the Runtime talk about *what* can be done without knowing *how*. The Runtime never imports `ffmpeg` or `canvas` — it only knows `video.transcode` and `image.resize`. Plugins declare capabilities; engines implement them; the Runtime resolves and dispatches.

This page documents [`@lokvis/capability`](https://github.com/lokvis/lokvis/tree/dev/packages/capability/src) and the `CapabilityRegistry` inside the Runtime.

## Module map

```
packages/capability/src/
├── names.ts              ← CapabilityName constants + domainOf() + sameDomain()
├── helpers.ts            ← filterByDomain / filterByInputType / groupByDomain / ...
└── presets/
    ├── builtin.ts        ← Aggregated BUILTIN_CAPABILITIES (all domains)
    ├── image.ts          ← IMAGE_CAPABILITIES (9 image capabilities)
    ├── video.ts          ← VIDEO_CAPABILITIES (7 stub)
    ├── pdf.ts            ← PDF_CAPABILITIES (7 stub)
    ├── asset.ts          ← ASSET_CAPABILITIES (load / export / rename / archive)
    ├── developer.ts      ← DEVELOPER_CAPABILITIES (dev tools)
    └── platform.ts       ← PLATFORM_PRESETS (63 platform size presets)
```

`@lokvis/capability` is a **declarative** package — it contains no executable logic, only type definitions, constants, and pure helper functions. It is safe to import from any layer.

## The `Capability` shape

```typescript
export interface Capability {
  name: CapabilityName;          // e.g. 'image.resize'
  description: string;
  inputTypes: AssetType[];       // ['image'] | ['video'] | ['pdf'] | ['archive'] | ...
  outputTypes: AssetType[];
  params: CapabilityParam[];
  performance: PerformanceLevel; // 'fast' | 'medium' | 'slow'
  batchable: boolean;

  // Optional MCP exposure (W11 AI-ecosystem shift)
  mcpExposure?: 'public' | 'private' | 'batch-only';
  mcpToolName?: string;          // override default 'lokvis_<domain>_<action>'
}
```

The `name` follows a strict `<domain>.<action>` convention. `domainOf('image.resize')` returns `'image'`. This convention is enforced by the helpers and used by the UI to group capabilities, by the MCP manifest generator to namespace tool names, and by the workflow validator to check capability compatibility between adjacent nodes.

## `CapabilityParam` and the param form

```typescript
export interface CapabilityParam {
  name: string;
  type: CapabilityParamType;     // 'number' | 'string' | 'boolean' | 'enum' | 'color' | 'file' | 'object' | 'array'
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  values?: string[];             // for 'enum'
  items?: CapabilityParamType;   // for 'array'
  description?: string;
}
```

The param form is what `ParamForm.tsx` in `@lokvis/ui-react` renders — it inspects `type` to pick the right control (number input / select / color picker / toggle / file input). Adding a new param to a capability automatically surfaces it in the UI, the workflow builder, and the MCP manifest's `inputSchema`.

## Capability catalog (Phase 1)

| Domain | Capabilities | Status |
|--------|--------------|--------|
| `image.*` | `resize` / `compress` / `convert` / `crop` / `rotate` / `flip` / `watermark` / `setBackground` / `filter` | ✅ stable (Canvas engine) |
| `asset.*` | `load` / `export` / `rename` / `archive` / `capabilities` | ✅ stable |
| `developer.*` | `dev.inspect-asset` / `dev.inspect-capabilities` / `dev.profile` / `dev.validate-workflow` | ✅ stable (plugin-dev) |
| `video.*` | `transcode` / `compress` / `trim` / `merge` / `screenshot` / `extract-audio` / `to-gif` | ⬜ stub (Phase 2: ffmpeg.wasm) |
| `pdf.*` | `compress` / `merge` / `split` / `rotate` / `watermark` / `sign` / `ocr` | ⬜ stub (Phase 2: pdf-lib) |

All 30+ capabilities are declared up front — even stubs — so the UI, MCP manifest, and docs can list the full future catalog. The `status` field on the implementation (not the declaration) tells the Runtime whether a capability is actually runnable.

## Helpers

`helpers.ts` exposes pure functions for capability discovery. UI / workflow editor / AI generator all use these:

```typescript
filterByDomain(caps, 'image')             // → image.* only
filterByInputType(caps, 'image')          // → caps that accept image input
filterByPerformance(caps, 'fast')         // → fast ops only
groupByDomain(caps)                       // → Map<domain, Capability[]>
findCapability(caps, 'image.resize')      // → Capability | undefined
isBatchable(cap)                          // → boolean
requiredParams(cap)                       // → CapabilityParam[]
optionalParams(cap)                       // → CapabilityParam[]
defaultParams(cap)                        // → Record<string, unknown>
mergeParams(cap, userParams)              // → defaults + user overrides
validateParams(cap, params)               // → string[] (missing required names)
```

`mergeParams` is what the workflow executor uses to fill in defaults before calling `impl.execute` — capabilities always receive a fully-populated params object.

## Platform presets

`presets/platform.ts` ships 63 size presets across 20+ platforms, organized in 5 categories:

| Category | Examples |
|----------|----------|
| `social` | Instagram square (1080×1080) / Instagram story (1080×1920) / Twitter card (1200×628) / ... |
| `ecommerce` | Amazon main (2000×2000) / eBay gallery (1600×1600) / Shopify hero (2048×1024) / ... |
| `video` | YouTube thumbnail (1280×720) / Vimeo cover (1280×720) / ... |
| `print` | A4 at 300 DPI (2480×3508) / Letter at 300 DPI (2550×3300) / Business card (1050×600) / ... |
| `other` | Favicon (512×512) / App icon (1024×1024) / OG image (1200×630) / ... |

These are pure data — the Resize tool's `PlatformPresetSelector` reads them to populate its dropdown. Custom user presets get the `custom.` namespace prefix to distinguish from built-in ones.

## CapabilityRegistry (Runtime-side)

The `CapabilityRegistry` class lives in `@lokvis/runtime` (not `@lokvis/capability`) because it manages **runtime state** — registered declarations and their implementations.

```typescript
class CapabilityRegistry {
  registerCapability(cap: Capability): void           // declare
  registerImplementation(impl: CapabilityImplementation): void  // provide engine
  resolve(name, preferredEngine?): CapabilityImplementation | undefined
  list(): Capability[]
  has(name): boolean
  isStubOnly(name): boolean
  hasImplementation(name): boolean
}
```

### The resolve flow

When the WorkflowExecutor hits a `transform` node, it calls `registry.resolve(node.capability)`:

1. Look up the `RegistryEntry` for the capability name
2. Filter out implementations where `status === 'stub'`
3. If `preferredEngine` was specified and matches, return it
4. Otherwise apply the `EngineSelectionStrategy`:
   - `'first'` (default) — first registered non-stub implementation
   - `'fastest'` — pick the one with the best `performance` (fast > medium > slow, ties broken by registration order for stability)
   - `'balanced'` — prefer an implementation whose `performance` matches the capability declaration's `performance`

If no non-stub implementation exists, `resolve` returns `undefined` and the executor throws `CAPABILITY_STUB_ONLY`. If no implementation exists at all (capability never registered), it throws `CAPABILITY_NOT_REGISTERED`.

### `CapabilityImplementation`

```typescript
export interface CapabilityImplementation {
  capability: CapabilityName;      // which capability this implements
  engine: string;                  // 'canvas' | 'ffmpeg' | 'pdf-lib' | ...
  status?: 'stable' | 'stub';      // default 'stable'
  performance?: PerformanceLevel;  // override the capability's declared performance
  execute(
    inputs: Asset[],
    params: Record<string, unknown>,
    execCtx: ExecutionContext
  ): Promise<Asset[]>
}
```

`ExecutionContext` carries `signal: AbortSignal` and `onProgress?: (ratio, message) => void`. Implementations are expected to:

- Check `signal.aborted` between expensive steps
- Call `onProgress` for long-running ops (used by `ProgressBar`)
- Return one or more output `Asset`s (the Plugin layer handles persistence via `AssetStore.create`)

## Workflow validation

The capability catalog is also used by `validateWorkflow()` in `@lokvis/schema` to check **compatibility** between adjacent nodes:

```typescript
validateWorkflow(workflow, {
  maxSteps: 5,
  resolveCapability: (name) => registry.get(name)
    ? { inputTypes: registry.get(name)!.inputTypes, outputTypes: registry.get(name)!.outputTypes }
    : undefined,
});
```

Three layers of compatibility:

1. **Input node** — its `inputTypes` must include `workflow.inputs.type`
2. **Adjacent nodes** — `edge.from.outputTypes ∩ edge.to.inputTypes` must be non-empty
3. **Output node** — its `outputTypes` must include `workflow.outputs.type`

This catches mismatches like "resize image → transcode video" at validation time, before any pixels are touched.

## MCP manifest generation

`runtime.toMcpManifest({ batchMode })` walks the capability registry and emits a JSON tool list:

```typescript
{
  name: 'lokvis_image_resize',          // ← capability.mcpToolName or default
  description: cap.description,
  inputSchema: capabilityParamsToJsonSchema(cap.params),
  capabilities: ['image.resize'],
}
```

The `mcpExposure` field controls visibility:
- `'public'` (default) — always exposed
- `'batch-only'` — only when `batchMode: true` (prevents single-file misuse of bulk operations)
- `'private'` — never exposed to MCP

`capabilityParamsToJsonSchema` is a hand-written mapper (no `zod-to-json-schema` dependency) that converts `CapabilityParam[]` to a standard JSON Schema object, mapping Lokvis-specific types (`color` → `{type:'string', format:'color'}`, `enum` → `{type:'string', enum:[...]}`, etc.).

## What the Capability layer explicitly does NOT do

- Implement any operation (engines do that)
- Persist anything (Runtime + AssetStore do that)
- Render any UI (the param form reads the schema, but the form lives in `ui-react`)
- Enforce permissions (declared in plugin config, advisory in Alpha)

## Further reading

- [Runtime Layer](./runtime) — where `CapabilityRegistry` lives
- [Engine Layer](./engine) — what implements capabilities
- [Plugin Layer](./plugin) — how capabilities get registered at startup
- [Capabilities reference](../capabilities) — the user-facing catalog

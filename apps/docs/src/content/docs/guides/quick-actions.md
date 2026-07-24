---
title: Quick Actions
description: Embed single-purpose image tools (compress / resize / convert / watermark / crop / pipeline) with a three-layer API — zero-config default UI, unstyled primitives, or a fully headless hook.
draft: false
head: []
---

# Quick Actions

Quick Actions are pre-aggregated, single-purpose image tools. Each one bundles Runtime init, file upload, `autoRun`, a preset switcher, and an `onComplete` callback into a single unit — so a user drops an image and gets a result with no parameter tuning.

They ship as a **three-layer API** so the same functionality can be consumed at six different levels of customization, from a one-line default UI down to a pure-logic hook.

## When to use Quick Actions

| Dimension | `<Workspace />` (full workbench) | Quick Actions (single tool) |
|---|---|---|
| Use case | Multi-tool studio for end users | Embed one tool (e.g. compress) into a host page |
| Bundle | ~200 KB JS + React 19 | ~80–120 KB (Runtime + engine-image + one Quick layer) |
| Customization | `enable*` toggles + plugins | 6 paths: theme / CSS vars / components / primitives / hook |
| Layout | Fixed Asset / Canvas / Inspector / Pipeline panels | Single compact card, embed-friendly |
| Pipeline | Drag-and-drop `WorkflowEditor` | Fixed preset pipelines (resize → compress → watermark) |

Choose `<Workspace />` for a full image studio. Choose a Quick Action when you want to drop "compress this image" or "resize to IG 1:1" into a host page with minimal chrome.

## Current packaging status

:::note
The Quick Action layers currently live inside `@lokvis/playground` (a private app package) at `apps/playground/src/components/tools/quick/`. They are **not yet published as a standalone npm package**.

The roadmap (see [`docs/reports/20260719-image-workspace-ui-design.md` §10.2](https://github.com/lokvis/lokvis/blob/main/docs/reports/20260719-image-workspace-ui-design.md)) calls for extracting them into a dedicated `@lokvis/embed-image` package with three subpath exports:

```bash
pnpm add @lokvis/embed-image @lokvis/plugin-image
```

```ts
import ImageQuickCompress from '@lokvis/embed-image';                 // Layer 2
import { QuickCompress } from '@lokvis/embed-image/primitives';        // Layer 1
import { useQuickCompress } from '@lokvis/embed-image/hooks';          // Layer 0
```

Until that extraction lands, the examples below use the source paths under `apps/playground/src/components/tools/quick/`. You can either copy the relevant files into your app or wait for the standalone package.
:::

## Three-layer architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Default UI — ImageQuickCompress / ImageQuickResize / … │
│   Tailwind-styled card, ErrorBoundary-wrapped, i18n-ready.      │
│   Customize via theme prop, components prop, className/style.   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Unstyled Primitives — QuickCompress.Upload / .Root / … │
│   Zero built-in styles. ARIA + data props + callbacks only.     │
│   Compose your own DOM with your own classes.                   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 0: Headless Hook — useQuickCompress() / useImagePipeline()│
│   Pure logic: Runtime + autoRun + presets + onComplete.         │
│   Build any UI (React/Vue/Web Component/vanilla) on top.        │
└─────────────────────────────────────────────────────────────────┘
```

Each Quick Action family follows the same contract:

| Family | Hook (L0) | Primitives (L1) | Default UI (L2) | Presets |
|---|---|---|---|---|
| Compress | `useQuickCompress` | `QuickCompress.*` | `ImageQuickCompress` | balanced / highQuality / small |
| Resize | `useQuickResize` | `QuickResize.*` | `ImageQuickResize` | ig-square / yt-landscape / tk-portrait / half |
| Convert | `useQuickConvert` | `QuickConvert.*` | `ImageQuickConvert` | png / webp / avif / jpeg |
| Watermark | `useQuickWatermark` | `QuickWatermark.*` | `ImageQuickWatermark` | small-br / large-center / tile |
| Crop | `useQuickCrop` | `QuickCrop.*` | `ImageQuickCrop` | square / 4:3 / 16:9 / free |
| Pipeline | `useImagePipeline` | `QuickPipeline.*` | `ImageQuickPipeline` | ecommerce / social / thumbnail / blog |

## The six integration paths

Each path trades convenience for control. Pick the lowest path that still meets your customization needs.

### Path 1 — Zero-config (Layer 2 default UI)

```tsx
import { ImageQuickCompress } from '@/components/tools/quick';

export default function Demo() {
  return <ImageQuickCompress />;
}
```

Drop in, get a styled card with upload area, preset switcher, before/after preview, ratio badge, download button, and an ErrorBoundary. Best for demos and internal tools.

### Path 2 — Theme customization (Layer 2 + `theme` prop)

```tsx
<ImageQuickCompress
  theme={{
    primary: '#00ff00',
    background: '#1a1a1a',
    surface: '#0f0f0f',
    radius: '0',
    fontFamily: 'Inter, sans-serif',
  }}
/>
```

The `theme` object is converted to CSS variables on the root element. All fields are optional; omitted fields fall back to the defaults declared on `.lokvis-quick-compress` (see `apps/playground/src/styles/global.css`).

| Field | CSS variable | Default |
|---|---|---|
| `primary` | `--lokvis-primary` | `#6366f1` |
| `primaryHover` | `--lokvis-primary-hover` | `#4f46e5` |
| `background` | `--lokvis-bg` | `transparent` |
| `surface` | `--lokvis-surface` | `#18181b` |
| `surfaceHover` | `--lokvis-surface-hover` | `#27272a` |
| `border` | `--lokvis-border` | `#27272a` |
| `text` | `--lokvis-text` | `#f4f4f5` |
| `textMuted` | `--lokvis-text-muted` | `#71717a` |
| `success` | `--lokvis-success` | `#10b981` |
| `warning` | `--lokvis-warning` | `#f59e0b` |
| `error` | `--lokvis-error` | `#ef4444` |
| `radius` | `--lokvis-radius` | `0.5rem` |
| `fontFamily` | `--lokvis-font-family` | `inherit` |

### Path 3 — Pure-CSS override (Layer 2 + CSS variables)

No JS needed. Override the variables on the root selector in your own stylesheet:

```css
.lokvis-quick-compress {
  --lokvis-primary: #00ff00;
  --lokvis-bg: #1a1a1a;
  --lokvis-radius: 0;
  --lokvis-font-family: 'Inter', sans-serif;
}
```

Useful when the host page already has a design system and you want to re-skin the default UI without touching JS.

### Path 4 — Component replacement (Layer 2 + `components` prop)

Swap individual sub-components — e.g. use AntD's `Upload` and `Button`:

```tsx
import { Upload as AntDUpload, Button as AntDButton } from 'antd';
import { ImageQuickCompress } from '@/components/tools/quick';

<ImageQuickCompress
  components={{
    UploadBox: ({ className, style, children }) => (
      <AntDUpload className={className} style={style}>{children}</AntDUpload>
    ),
    DownloadButton: ({ className, style, children }) => (
      <AntDButton type="primary" className={className} style={style}>{children}</AntDButton>
    ),
  }}
/>
```

The full replacement surface for `ImageQuickCompress` is `QuickCompressComponents`:

```ts
interface QuickCompressComponents {
  UploadBox:      ComponentType<UploadBoxProps>;
  PreviewBox:     ComponentType<PreviewBoxProps>;
  PresetSwitcher: ComponentType<PresetSwitcherProps>;
  DownloadButton: ComponentType<DownloadButtonProps>;
  RatioBadge:     ComponentType<RatioBadgeProps>;
  ErrorDisplay:   ComponentType<ErrorDisplayProps>;
  ResetButton:    ComponentType<ResetButtonProps>;
}
```

Each Quick family exposes its own `*Components` interface — see the type re-exports in `apps/playground/src/components/tools/quick/index.ts`.

### Path 5 — Primitive composition (Layer 1)

Take the unstyled primitives and assemble your own DOM with your own classes. The primitives provide behaviour + ARIA; you provide everything visual.

```tsx
import { QuickCompress } from '@/components/tools/quick';

function MyCustomCompress() {
  return (
    <QuickCompress.Root initialPreset="balanced" onComplete={(r) => console.log(r)}>
      <QuickCompress.Upload className="my-upload">Click or drop image</QuickCompress.Upload>
      <QuickCompress.PresetSwitcher className="my-switcher" />
      <QuickCompress.Preview type="input" className="my-input-preview" />
      <QuickCompress.Preview type="output" className="my-output-preview" />
      <QuickCompress.RatioBadge className="my-ratio" />
      <QuickCompress.DownloadButton className="my-btn">Download</QuickCompress.DownloadButton>
      <QuickCompress.ErrorDisplay className="my-error" />
      <QuickCompress.ResetButton className="my-reset">Try another</QuickCompress.ResetButton>
    </QuickCompress.Root>
  );
}
```

Primitive rules:

- **Zero built-in styles.** Every primitive accepts `className` / `style` / `children` and applies them to its root element.
- **ARIA out of the box.** `Upload` exposes `role="button"` + keyboard handlers; `PresetSwitcher` exposes `role="radiogroup"`; `ErrorDisplay` exposes `role="alert"`; `RatioBadge` exposes `role="status"`.
- **Render-prop escape hatch.** `Upload` accepts `children` as a function of `{ isDragging }`; `PresetSwitcher` accepts `renderButton(preset, isSelected, onClick)`.
- **Context-required.** All primitives must be used inside `<QuickCompress.Root>` (which calls `useQuickCompress` and shares state via React Context).

### Path 6 — Fully headless (Layer 0 hook)

Skip the UI entirely and drive the Runtime yourself:

```tsx
import { useQuickCompress } from '@/components/tools/quick';

function MyVueLikeCompress() {
  const {
    ready, initError,
    inputUrl, outputUrl, ratio,
    busy, error,
    preset, setPreset,
    handleFiles, reset, clearError, run,
  } = useQuickCompress({ initialPreset: 'balanced', onComplete: (r) => console.log(r) });

  if (initError) return <p>Failed to init: {initError}</p>;
  if (!ready) return <p>Loading…</p>;

  return (
    <div className="my-own-ui">
      <input type="file" onChange={(e) => e.target.files && handleFiles([...e.target.files])} />
      {busy && <p>Processing…</p>}
      {error && <p role="alert">{error}</p>}
      {inputUrl  && <img src={inputUrl}  alt="input" />}
      {outputUrl && <img src={outputUrl} alt="output" />}
      {ratio !== null && <span>{ratio >= 0 ? 'Saved' : 'Increased'} {Math.abs(ratio).toFixed(1)}%</span>}
      <select value={preset} onChange={(e) => setPreset(e.target.value as 'balanced' | 'highQuality' | 'small')}>
        <option value="balanced">Balanced</option>
        <option value="highQuality">High Quality</option>
        <option value="small">Small</option>
      </select>
      <button onClick={reset}>Reset</button>
      <button onClick={() => void run()} disabled={busy}>Run</button>
    </div>
  );
}
```

The hook returns a uniform contract across all six families. See `UseQuickCompressResult` in [`useQuickCompress.ts`](https://github.com/lokvis/lokvis/blob/main/apps/playground/src/components/tools/quick/useQuickCompress.ts) for the canonical field list.

## Hook contract

All single-step Quick hooks share `UseQuickActionOptions`:

```ts
interface UseQuickActionOptions<Preset extends string = string> {
  /** Initial preset (each hook has its own default). */
  initialPreset?: Preset;
  /** Auto-run on upload. Default: true. Set false for pipeline middle nodes. */
  autoRun?: boolean;
  /** Fired once per unique output Blob — chain to the next hook or external state. */
  onComplete?: (result: QuickActionResult) => void;
  /** Inject an input Blob (used by pipelines: previous hook's output → this hook's input). */
  inputBlob?: Blob | null;
}

interface QuickActionResult {
  outputBlob: Blob;
  outputUrl: string;
  inputSize: number;
  outputSize: number;
  preset: string;
}
```

`onComplete` is de-duplicated by Blob reference — passing the same Blob twice fires only once. This is what lets you chain `useQuickResize` → `useQuickCompress` without double-running.

## Theme system

The theme system is dual-layer (see [`theme.ts`](https://github.com/lokvis/lokvis/blob/main/apps/playground/src/components/tools/quick/theme.ts)):

1. **`theme` prop** — programmatic, JS object → CSS variables on the root element. Highest priority.
2. **CSS variables** — runtime override via `.lokvis-quick-* { --lokvis-*: ... }` in your stylesheet. Lets a host page re-skin without touching JS.

Both layers compose: `theme` prop values win over CSS-variable defaults, and any field omitted from `theme` falls back to the CSS default. The Layer 2 Tailwind classes reference `var(--lokvis-*)` rather than hard-coded colors, so any variable change propagates automatically.

## Pipeline mode

`useImagePipeline` / `QuickPipeline` / `ImageQuickPipeline` chain multiple image capabilities into a single workflow. Unlike the single-step hooks, the pipeline uses `WorkflowBuilder` to construct a multi-node workflow and reads `result.stepOutputs` to surface intermediate results.

```tsx
import { useImagePipeline } from '@/components/tools/quick';

function MyPipeline() {
  const { busy, currentStep, steps, outputBlob, handleFiles } = useImagePipeline({
    initialPreset: 'ecommerce',
  });

  return (
    <div>
      <input type="file" onChange={(e) => e.target.files && handleFiles([...e.target.files])} />
      {busy && <p>Running step {currentStep + 1}…</p>}
      {steps.map((step) => (
        <figure key={step.index}>
          <img src={step.url} alt={step.label} />
          <figcaption>{step.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
```

Each `step` is a `PipelineStepOutput` with `{ index, label, capability, blob, url, info }`. The hook also exposes the underlying `workflow` (a `WorkflowBuilder`-built `Workflow`) so you can render node metadata yourself.

Built-in presets:

| Preset | Steps | Use case |
|---|---|---|
| `ecommerce` | resize(1080) → compress(q80) → watermark(@brand) | E-commerce product images |
| `social` | resize(IG 1:1) → compress(q92) | Instagram posts |
| `thumbnail` | resize(400) → compress(q65) | List previews |
| `blog` | resize(1200) → compress(q80) → watermark(@blog) | Blog post images |

To define your own pipeline, construct a `Workflow` with `WorkflowBuilder` directly (see [`@lokvis/workflow`](https://github.com/lokvis/lokvis/blob/main/packages/workflow)) and pass it to `runtime.run`. `buildPipelineWorkflow(preset)` is just a thin wrapper that maps a preset key to a fixed step list — extending it with new presets is a one-entry change to `PIPELINE_PRESETS` in [`useImagePipeline.ts`](https://github.com/lokvis/lokvis/blob/main/apps/playground/src/components/tools/quick/useImagePipeline.ts).

## COOP/COEP headers

Like the full `<Workspace />`, Quick Actions use the image engine which runs heavy decode/draw/encode inside a Web Worker. To enable `SharedArrayBuffer` for future WASM engines, your host document must be cross-origin isolated:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

See [Embed the SDK](./embed-sdk) for Vite / Cloudflare Pages / Netlify configuration of these headers (the "COOP/COEP headers for SharedArrayBuffer" section). The Canvas engine works without them; only future WASM engines require them.

## Known limitations

These are the gaps third-party integrators should be aware of today. They are tracked in the design doc and will be addressed in follow-up PRs.

1. **No standalone npm package yet.** All six families live in `@lokvis/playground` and import playground-internal helpers (`useImageTool`, `useLokvisRuntime`, `getImageInfo`, i18n). You currently have to copy the source. Extraction to `@lokvis/embed-image` is planned.
2. **`useLokvisRuntime` hard-codes `imageToolsPlugin`.** Third parties that want to combine image Quick Actions with audio / pdf / video plugins in the same Runtime must fork the hook or build their own equivalent. A `plugins` option on the hook is on the roadmap.
3. **Layer 2 default UI pulls i18n from `apps/playground/src/i18n`.** The default UI works out-of-the-box inside the playground; outside the playground, either replace the text-bearing sub-components via the `components` prop or build on Layer 1 / Layer 0 instead.
4. **Image-only.** The Quick pattern is built on `useImageTool` + `buildSingleStepImageWorkflow` + `getImageInfo`. There is no `useQuickAudio` / `useQuickPdf` / `useQuickVideo` family yet.
5. **Preset pipelines are fixed.** Phase C ships four preset pipelines. A visual pipeline editor is deferred to a later phase — for now, custom multi-step workflows go through `WorkflowBuilder` directly.

## Next steps

- [Embed the SDK](./embed-sdk) — full `<Workspace />` integration for multi-tool studios.
- [Build a Custom Workspace](./custom-workspace) — Runtime-only, no React UI.
- [Write Your First Plugin](./write-first-plugin) — add a new capability to the catalog.

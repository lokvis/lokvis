---
title: Quick Actions Integration Guide
description: Integrate Lokvis Quick Actions (Compress / Resize / Convert / Watermark / Crop / Pipeline) using the three-layer architecture — pick the integration depth that matches your use case, from zero-config default UI to fully headless hooks.
draft: false
head: []
---

# Quick Actions Integration Guide

Quick Actions are opinionated, single-purpose image tools — Compress, Resize, Convert, Watermark, Crop, and Pipeline — built on a **three-layer architecture** that lets third parties choose their integration depth.

> **Status: Alpha.** The Quick Action API ships inside the playground app today. To consume it in a host app you currently copy the `apps/playground/src/components/tools/quick/` directory into your project. A dedicated `@lokvis/quick-image` package is planned (see [§6 Roadmap](#_6-known-limitations--roadmap)).

## Architecture overview

```
┌──────────────────────────────────────────────────────┐
│ Layer 2  ImageQuickCompress  (default UI, Tailwind)  │  ← zero-config
├──────────────────────────────────────────────────────┤
│ Layer 1  QuickCompress.Root / Upload / Preview / ... │  ← unstyled primitives
├──────────────────────────────────────────────────────┤
│ Layer 0  useQuickCompress()  (headless hook)         │  ← pure logic
└──────────────────────────────────────────────────────┘
```

Each layer builds on the one below. Layers are **substitutable**: Layer 2 composes Layer 1, Layer 1 consumes Layer 0. You can enter at any layer and replace anything above it.

| Layer | What you get | What you write | When to stop here |
|---|---|---|---|
| **Layer 2** | Default UI with Tailwind, i18n, ErrorBoundary | `<ImageQuickCompress />` (1 line) | "It looks fine, I just want to theme it" |
| **Layer 1** | Unstyled primitives with behavior (drag, ARIA, state) | `<QuickCompress.Root>...</QuickCompress.Upload>...` | "I want full layout control, default logic is fine" |
| **Layer 0** | Headless hook (state, presets, runtime, callbacks) | Your own JSX consuming `useQuickCompress()` | "I want a totally different UI, or no UI at all" |

## The six tools

| Tool | Hook | Capability | Output |
|---|---|---|---|
| Compress | `useQuickCompress` | `image.compress` | Smaller WebP (q65/80/92) |
| Resize | `useQuickResize` | `image.resize` | Fixed dimensions (1280/1920/IG 1:1/Story 9:16) |
| Convert | `useQuickConvert` | `image.convert` | PNG / WebP / AVIF / JPEG |
| Watermark | `useQuickWatermark` | `image.watermark` | Text overlay (brand/copyright/custom) |
| Crop | `useQuickCrop` | `image.crop` | Square / 4:3 / 16:9 / free |
| Pipeline | `useImagePipeline` | Multi-step workflow | E-commerce / Social / Thumbnail / Blog presets |

All six tools share the same hook contract (`UseQuickActionOptions`) and the same primitive shape (8 slots: Root / Upload / PresetSwitcher / Preview / [tool-specific] / DownloadButton / ErrorDisplay / ResetButton).

## Integration paths (freedom increasing)

### Path 1 — Zero-config default UI

Drop in `<ImageQuickCompress />` and you get a complete card UI with upload, preset switcher, before/after preview, compression ratio, download, reset, and error display. Built-in `ErrorBoundary` catches any runtime error and degrades gracefully.

```tsx
import { ImageQuickCompress } from './tools/quick';

export function MyPage() {
  return <ImageQuickCompress />;
}
```

All six tools follow the same pattern: `ImageQuickCompress`, `ImageQuickResize`, `ImageQuickConvert`, `ImageQuickWatermark`, `ImageQuickCrop`, `ImageQuickPipeline`.

#### Common props (all 6 tools)

| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | `''` | Appended to root div |
| `style` | `CSSProperties` | — | Merged after theme CSS vars |
| `theme` | `QuickTheme` | — | Theme tokens → CSS vars (see [Theme guide](./quick-actions-theme)) |
| `components` | `Partial<QuickXxxComponents>` | — | Slot replacements (see [Path 4](#path-4--component-slot-replacement)) |
| `showPresetSwitcher` | `boolean` | `true` | Hide the preset radio group |
| `showBeforeAfter` | `boolean` | `true` | Show input preview alongside output |
| `showDownloadButton` | `boolean` | `true` | Hide download button |
| `showResetButton` | `boolean` | `true` | Hide reset button |
| `initialPreset` | `Preset` | tool default | Initial preset selection |
| `autoRun` | `boolean` | `true` | Run automatically on upload |
| `onComplete` | `(result: QuickActionResult) => void` | — | Fires once per new output Blob |
| `inputBlob` | `Blob \| null` | — | Inject input (for chaining tools) |

Tool-specific props: `showRatio` (Compress), `showFormat` (Convert), `showDimension` (Resize), `showTextInput` (Watermark), `showCropArea` (Crop), `showStepList` (Pipeline).

### Path 2 — Theme customization

Pass a `theme` object to recolor the entire card without touching CSS:

```tsx
<ImageQuickCompress
  theme={{
    primary: '#0ea5e9',
    surface: '#0f172a',
    success: '#22c55e',
    radius: '0.75rem',
  }}
/>
```

The 13 theme tokens map to `--lokvis-*` CSS variables. Unspecified tokens fall back to CSS defaults (defined in `global.css`). See the [Theme Customization guide](./quick-actions-theme) for the full token list, dark-mode notes, and the CSS-variable override path.

### Path 3 — CSS variable override (no JS)

If you only need to recolor and prefer CSS over the `theme` prop, override the CSS variables on the root class:

```css
.my-app .lokvis-quick-compress {
  --lokvis-primary: #0ea5e9;
  --lokvis-surface: #0f172a;
  --lokvis-radius: 0.75rem;
}
```

The root div carries a `lokvis-quick-compress` / `lokvis-quick-resize` / ... class for this purpose. This path requires no `!important` — the variable cascade wins naturally.

### Path 4 — Component slot replacement

Replace any of the 7 internal sub-components (Root is not replaceable) via the `components` prop:

```tsx
<ImageQuickCompress
  components={{
    UploadBox: MyUploadBox,
    DownloadButton: MyDownloadButton,
    // Other slots fall back to defaults
  }}
/>
```

The 7 slots per tool:

| Slot | Default role | Slot props |
|---|---|---|
| `UploadBox` | Drop zone + file picker | `{ className?, style?, children? }` |
| `PreviewBox` | Image preview (input or output) | `{ type: 'input' \| 'output', className?, style? }` |
| `PresetSwitcher` | Preset radio group | `{ className?, style? }` |
| `DownloadButton` | Download trigger | `{ className?, style?, children? }` |
| `ErrorDisplay` | Error message | `{ className?, style? }` |
| `ResetButton` | Reset trigger | `{ className?, style?, children? }` |
| Tool-specific | `RatioBadge` / `FormatBadge` / `DimensionBadge` / `TextInput` / `CropAreaBox` / `StepListBox` | `{ className?, style? }` |

> **Known limitation:** slot replacements currently receive only `{ className, style, children }` — they do **not** receive hook state (preset, busy, error, inputUrl, outputUrl). If your custom `PresetSwitcher` needs to know the current preset, use [Path 6](#path-6--fully-headless-hook) instead. Enriching slot props with state is on the roadmap (see [§6](#_6-known-limitations--roadmap)).

### Path 5 — Primitive composition (Radix-style)

Drop down to Layer 1 and compose the unstyled primitives yourself. Each primitive has behavior baked in (drag-and-drop, ARIA, keyboard, state subscription) but no styling — you own the layout.

```tsx
import { QuickCompress } from './tools/quick';

export function MyCompressCard() {
  return (
    <QuickCompress.Root autoRun onComplete={(r) => console.log(r.outputSize)}>
      <QuickCompress.Upload
        className="my-upload"
        accept="image/*"
      >
        {({ isDragging }) => (isDragging ? 'Drop it' : 'Click or drop')}
      </QuickCompress.Upload>

      <QuickCompress.PresetSwitcher
        renderButton={(preset, isSelected, onClick) => (
          <button
            key={preset}
            onClick={onClick}
            className={isSelected ? 'active' : ''}
          >
            {preset}
          </button>
        )}
      />

      <div className="my-preview-row">
        <QuickCompress.Preview type="input" />
        <QuickCompress.Preview type="output" />
      </div>

      <QuickCompress.RatioBadge />
      <QuickCompress.DownloadButton fileName="compressed" />
      <QuickCompress.ErrorDisplay />
      <QuickCompress.ResetButton>Try another</QuickCompress.ResetButton>
    </QuickCompress.Root>
  );
}
```

Each primitive reads its state from a React Context provided by `<QuickCompress.Root>`. Calling a primitive outside `<Root>` throws an error. The 8 primitives per tool:

| Primitive | Responsibility |
|---|---|
| `Root` | Provides context, calls the Layer 0 hook |
| `Upload` | Drag-and-drop + click + keyboard file selection |
| `PresetSwitcher` | Renders preset buttons, supports `renderButton` for full control |
| `Preview` | Renders `<img>` for input or output, with metadata caption |
| Tool-specific | `RatioBadge` / `FormatBadge` / `DimensionBadge` / `TextInput` / `CropArea` / `StepList` |
| `DownloadButton` | Triggers `downloadBlob()` with auto-extension |
| `ErrorDisplay` | Renders `error` or `initError` from state |
| `ResetButton` | Triggers `reset()`, disabled when empty |

### Path 6 — Fully headless hook

Drop down to Layer 0 and own the entire UI. The hook gives you state, actions, and callbacks — no React components at all.

```tsx
import { useQuickCompress } from './tools/quick';

export function MyHeadlessCompress() {
  const {
    ready,
    busy,
    error,
    inputUrl,
    outputUrl,
    outputBlob,
    ratio,
    preset,
    setPreset,
    handleFiles,
    reset,
    clearError,
    run,
  } = useQuickCompress({
    initialPreset: 'balanced',
    autoRun: true,
    onComplete: (result) => {
      console.log(`Compressed: ${result.inputSize} → ${result.outputSize} bytes`);
    },
  });

  if (!ready) return <p>Loading runtime…</p>;

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
      />
      <select value={preset} onChange={(e) => setPreset(e.target.value as any)}>
        <option value="balanced">Balanced</option>
        <option value="highQuality">High Quality</option>
        <option value="small">Small</option>
      </select>
      {busy && <p>Processing…</p>}
      {error && <p role="alert">{error}</p>}
      {ratio !== null && <p>Saved {ratio.toFixed(1)}%</p>}
      {inputUrl && <img src={inputUrl} alt="input" />}
      {outputUrl && <img src={outputUrl} alt="output" />}
      {outputBlob && (
        <a href={outputUrl!} download={`compressed.${outputBlob.type.split('/')[1]}`}>
          Download
        </a>
      )}
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

#### Hook return values (all 6 tools share most fields)

| Field | Type | Description |
|---|---|---|
| `ready` | `boolean` | Runtime initialized |
| `initError` | `string \| null` | Runtime init failure |
| `inputUrl` | `string \| null` | Object URL for preview |
| `inputInfo` | `ImageInfo \| null` | `{ width, height, size, format }` |
| `outputUrl` | `string \| null` | Object URL for preview |
| `outputInfo` | `ImageInfo \| null` | Output metadata |
| `outputBlob` | `Blob \| null` | The output blob |
| `busy` | `boolean` | Processing in progress |
| `error` | `string \| null` | Workflow execution error |
| `preset` | `Preset` | Current preset |
| `setPreset` | `(p: Preset) => void` | Switch preset (auto-reruns if input exists) |
| `handleFiles` | `(files: File[]) => Promise<void>` | Set input from file picker / drop |
| `reset` | `() => void` | Clear input + output |
| `clearError` | `() => void` | Clear error state |
| `run` | `() => Promise<void>` | Manual trigger (when `autoRun: false`) |
| `ratio` (Compress) | `number \| null` | Compression ratio (-100 ~ 100) |
| `cropRect` (Crop) | `CropRect \| null` | Current crop region |
| `setCropRect` (Crop) | `(r: CropRect) => void` | Update crop region |
| `watermarkText` (Watermark) | `string` | Current watermark text |
| `setWatermarkText` (Watermark) | `(t: string) => void` | Update text |
| `steps` (Pipeline) | `PipelineStepOutput[]` | Per-step intermediate results |
| `currentStep` (Pipeline) | `number` | Currently executing step index |
| `workflow` (Pipeline) | `Workflow` | The constructed pipeline workflow |

## Chaining tools into a custom pipeline

The `inputBlob` option lets one tool's output feed another's input. Combined with `onComplete`, you can chain Quick Actions into ad-hoc pipelines:

```tsx
function ChainedTools() {
  const [compressed, setCompressed] = useState<Blob | null>(null);
  const [watermarked, setWatermarked] = useState<Blob | null>(null);

  const compress = useQuickCompress({
    onComplete: (r) => setCompressed(r.outputBlob),
  });
  const watermark = useQuickWatermark({
    inputBlob: compressed,           // ← feed compress output
    onComplete: (r) => setWatermarked(r.outputBlob),
  });

  return (
    <>
      <ImageQuickCompress {...compress} />
      <ImageQuickWatermark {...watermark} />
      {watermarked && <a href={URL.createObjectURL(watermarked)} download="final.webp">Download</a>}
    </>
  );
}
```

For pre-defined multi-step pipelines (e-commerce / social / thumbnail / blog), use `useImagePipeline` instead — it constructs a single multi-node `Workflow` and exposes `steps[]` with per-step intermediate results via a single `runtime.run()` call.

## Internationalization

Layer 2 components read translations from the i18n dictionary (`apps/playground/src/i18n/ui.ts`). Translation keys follow the pattern `quickCompress.*`, `quickResize.*`, `quickConvert.*`, `quickWatermark.*`, `quickCrop.*`, `quickPipeline.*`.

Supported languages today: English (default), 简体中文, 日本語, Español, Deutsch, Français.

> **Known limitation:** the `Language` type is a closed union of 6 strings and the dictionary is a const, not a runtime registry. Adding a new language (e.g. Korean) currently requires editing `i18n/config.ts` + `i18n/ui.ts`. There is no `labels` prop on Layer 2 components to override individual strings. A runtime translation registration API is on the roadmap. For now, if you need a non-supported language, use [Path 5](#path-5--primitive-composition-radix-style) or [Path 6](#path-6--fully-headless-hook) and render your own strings.

## Accessibility

All Layer 1 and Layer 2 components ship with ARIA out of the box:

- `Upload` is a `role="button"` with `aria-disabled`, `aria-label`, keyboard (Enter / Space) activation, and drag state.
- `PresetSwitcher` is a `role="radiogroup"` with `aria-label`; each preset button is `role="radio"` with `aria-checked`.
- `Preview` has `aria-label="input/output preview"`.
- `DownloadButton` and `ResetButton` are `type="button"`.
- `ErrorDisplay` is `role="alert"`.
- `RatioBadge` / `FormatBadge` / `DimensionBadge` are `role="status"`.
- `CropArea` is `role="img"` with an `aria-label` describing the crop region.
- `StepList` is a `<ol role="list">` with per-step `aria-label` describing running / pending / done state.

When you replace slots via `components` (Path 4), preserve these ARIA semantics in your replacement to keep the component accessible.

## 6. Known limitations & roadmap

The Quick Action API is **Alpha** — the three-layer architecture is stable, but several extensibility surfaces are still closed. Known gaps third parties may hit:

| Gap | Workaround | Plan |
|---|---|---|
| Not packaged as `@lokvis/quick-image` | Copy `tools/quick/` directory into your project | Extract to a published package in Phase 2 |
| Closed preset registry (cannot add custom presets via props) | Use Layer 0 hook with your own preset state + `run()` | Add `presets` prop to Layer 2 in Phase 2 |
| Closed i18n (6 hard-coded languages, no runtime registration) | Use Layer 0/1 and render your own strings | Add `labels` prop + runtime registration in Phase 2 |
| Slot replacements don't receive hook state | Use Layer 0/1 directly | Enrich slot props with `{ state }` in Phase 2 |
| No `onError` / `onProgress` callbacks | Poll `error` state and `busy` boolean | Add callbacks in Phase 2 |
| Some default strings bypass i18n (preset labels, "Drop image", etc.) | Replace the slot via `components` prop | Wire all strings through `t()` in Phase 2 |

If you hit one of these, file an issue at [github.com/lokvis/lokvis/issues](https://github.com/lokvis/lokvis/issues) describing your use case — it helps prioritize the Phase 2 work.

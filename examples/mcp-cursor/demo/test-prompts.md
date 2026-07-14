# Test Prompts for Cursor + Lokvis

Paste these prompts into Cursor's Chat / Composer after configuring the Lokvis MCP server (see [`../README.md`](../README.md)). Each prompt is tuned for a code-repo context — paths assume `LOKVIS_WORKDIR` is your repo root.

## Image processing

### 1. Compress a single image

> Compress `assets/hero.png` to 80% quality. Save it next to the original as `assets/hero_compressed.png`.

Expected tool call: `lokvis_image_compress` with `input_path: "assets/hero.png"`, `quality: 80`, `output_path: "assets/hero_compressed.png"`.

### 2. Generate multiple favicon sizes

> Generate 32×32 and 16×16 favicons from `public/icon.svg`. Save them as `public/favicon-32.png` and `public/favicon-16.png`.

Expected tool calls: `lokvis_image_resize` × 2 — one with `width: 32, height: 32, output_path: "public/favicon-32.png"`, one with `width: 16, height: 16, output_path: "public/favicon-16.png"`.

### 3. Convert format

> Convert `public/og/preview.png` to WebP at quality 85.

Expected tool call: `lokvis_image_convert` with `input_path: "public/og/preview.png"`, `format: "webp"`, `quality: 85`.

### 4. Resize for retina display

> Resize `assets/banner.png` to 1920px width, maintaining aspect ratio.

Expected tool call: `lokvis_image_resize` with `input_path: "assets/banner.png"`, `width: 1920`.

### 5. Batch compress all screenshots

> Compress every PNG in `docs/screenshots/` to 70% quality. Keep the originals, save the compressed versions as `*_compressed.png` in the same folder.

Expected behaviour: Cursor iterates the folder and calls `lokvis_image_compress` per file. Confirm each call sets `quality: 70` and uses the default `_compressed` suffix.

## Verification

For each prompt, check that:

1. Cursor's tool-use indicator shows a `lokvis_image_*` call (visible in the agent transcript)
2. The output file appears at the expected path (visible in Cursor's file tree)
3. Cursor reports the result text from the tool (e.g., "Image resized successfully. Input: … Output: … Dimensions: 1920×1080")
4. **No file was uploaded** — all processing happened locally via sharp. Confirm with Cursor's network indicator or by checking the lokvis-mcp stderr logs (`[lokvis-mcp]` lines).

## Edge cases to test

- **Non-existent file:** "Compress `assets/missing.png`" → tool should return `isError: true` with a clear message; Cursor should relay it to you rather than retry silently.
- **Unsupported format:** "Compress `README.md`" → sharp will reject non-image input; the error should surface in the tool result.
- **Path traversal:** "Compress `../../../etc/passwd`" → must be rejected. `LOKVIS_WORKDIR` is the root; paths outside it should be treated as errors (verify by reading the Lokvis security docs).
- **Large batch (>50 files):** should complete sequentially. If your Cursor build streams tool calls, you should see progress per file.
- **Output path collision:** "Compress `assets/hero.png` to `assets/hero.png`" (same path) → sharp will overwrite. Confirm intended behaviour or pass a distinct `output_path`.

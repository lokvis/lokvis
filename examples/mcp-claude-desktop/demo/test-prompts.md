# Test Prompts for Claude Desktop + Lokvis

Paste these prompts into Claude Desktop after configuring the Lokvis MCP server (see [`../README.md`](../README.md)).

Drop `sample-image.jpg` into the chat or reference a path inside `LOKVIS_WORKDIR`.

## 1. Compress an image

> Compress this image to under 100KB.

Expected tool call: `lokvis_image_compress` with `quality: 80` (then re-run with lower quality if the result is still >100KB). The current tool exposes `quality` rather than `target_size_kb`; let Claude iterate quality until the output is under 100KB.

## 2. Batch resize

> Resize all images in /Users/me/photos to 1920px width, maintaining aspect ratio.

Expected tool calls: `lokvis_image_resize` per file, with `width: 1920` and the default `fit: "cover"` (or `fit: "inside"` to avoid cropping).

## 3. Convert format

> Convert image.png to WebP.

Expected tool call: `lokvis_image_convert` with `format: "webp"`.

## 4. Watermark

> Add a "Confidential" watermark to the bottom-right of report.png. Make it semi-transparent.

Expected tool call: `lokvis_image_watermark` *(Phase 2 planned; not yet exposed as an MCP tool — the underlying `image.watermark` capability is implemented in `engine-image` (browser) / `engine-image/node` (Node) and registered in `plugin-image`, but the MCP tool wrapper is pending).*

## 5. Run a workflow

> Run my "web-optimize" workflow on hero.png.

Expected tool call: `lokvis_run_workflow` *(Phase 2 planned; not yet exposed as an MCP tool).*

## Verification

For each prompt, check that:

1. Claude calls the Lokvis tool (visible in the tool-use indicator)
2. The output file appears in `LOKVIS_WORKDIR` (or as specified)
3. Claude reports the result (e.g., "Compressed image saved to ...")
4. No file was uploaded (privacy indicator should show "local only")

## Edge Cases to Test

- **Non-existent file:** "Compress /Users/me/missing.jpg" → should return an error gracefully
- **Unsupported format:** "Compress file.txt" → should refuse (not an image)
- **Path traversal:** "Compress ../../../etc/passwd" → should be rejected by the security model
- **Large batch (>100 files):** should be capped at 100 with a clear message

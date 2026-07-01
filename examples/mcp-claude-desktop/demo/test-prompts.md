# Test Prompts for Claude Desktop + Lokvis

Paste these prompts into Claude Desktop after configuring the Lokvis MCP server (see [`../README.md`](../README.md)).

Drop `sample-image.jpg` into the chat or reference a path inside `LOKVIS_WORKDIR`.

## 1. Compress an image

> Compress this image to under 100KB.

Expected tool call: `lokvis_compress_image` with `target_size_kb: 100`.

## 2. Batch resize

> Resize all images in /Users/me/photos to 1920px width, maintaining aspect ratio.

Expected tool call: `lokvis_batch_process` with `operation: "resize"`, `params: { width: 1920, maintain_aspect: true }`, `output_dir: "/Users/me/photos/resized"`.

## 3. Convert format

> Convert image.png to WebP.

Expected tool call: `lokvis_convert_image` with `output_format: "webp"`.

## 4. Watermark

> Add a "Confidential" watermark to the bottom-right of report.png. Make it semi-transparent.

Expected tool call: `lokvis_watermark_image` with `text: "Confidential"`, `position: "bottom-right"`, `opacity: 0.5`.

## 5. Run a workflow

> Run my "web-optimize" workflow on hero.png.

Expected tool call: `lokvis_run_workflow` with `workflow_id: "web-optimize"`, `input_path: "hero.png"`.

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

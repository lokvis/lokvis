---
title: Capabilities
description: Lokvis uses a <domain>.<action> naming convention for all capabilities.
draft: false
head: []
---

# Capabilities

Capabilities use a `<domain>.<action>` naming convention. Runtime never knows about specific engines — only capabilities.

## Domains

- `asset.*` — cross-cutting asset operations
- `image.*` — image processing
- `video.*` — video processing
- `audio.*` — audio processing
- `pdf.*` — PDF operations
- `ai.*` — AI-powered operations
- `developer.*` — developer tools (introspection, profiling)

## Built-in Capabilities

### Image

- `image.resize` — Resize with fit strategies (cover/contain/fill/inside/outside)
- `image.compress` — Compress with quality or target size
- `image.convert` — Convert format (png/jpeg/webp/avif/gif)
- `image.crop` — Crop to a region
- `image.rotate` — Rotate by degrees
- `image.flip` — Flip horizontally/vertically/both
- `image.watermark` — Add text or image watermark
- `image.background` — Set background color
- `image.filter` — Apply preset filter (grayscale/invert/sepia/blur), with optional `radius` for blur

### Video

- `video.compress`
- `video.transcode`
- `video.trim`
- `video.merge`
- `video.extract-audio`
- `video.to-gif`
- `video.screenshot`

### PDF

- `pdf.merge`
- `pdf.split`
- `pdf.compress`
- `pdf.rotate`
- `pdf.watermark`
- `pdf.ocr`
- `pdf.sign`

### Audio

- `audio.trim` — Trim to a time range
- `audio.merge` — Merge multiple clips into one
- `audio.transcode` — Transcode (MP3/WAV/OGG/AAC)
- `audio.normalize` — Normalize loudness to a target level

> Note: `audio.denoise` is not yet declared in the manifest or engine-audio. If needed in the future, it must be added to `packages/capability/manifests/audio.manifest.json`, `engine-audio`, and `plugin-audio` together.

### AI

- `ai.generate-workflow` — AI-assisted workflow JSON generation (cloudProxyEngine)
- `ai.optimize-workflow` — Optimize an existing workflow (cloudProxyEngine)
- `ai.ocr` — Local OCR (transformersEngine)
- `ai.caption` — Image captioning for accessibility/SEO (transformersEngine)
- `ai.background-remove` — Background removal (transformersEngine)

### Asset

- `asset.rename` — Pattern-based rename (`{name}` `{index}` `{date}`)
- `asset.archive` — Pack assets into a zip

### Developer

- `developer.inspect.capabilities`
- `developer.inspect.asset`
- `developer.validate.workflow`
- `developer.profile`

## Custom Capabilities

Plugins can declare custom capabilities with any name. Standardized names help with Marketplace search, workflow portability, and AI workflow generation.

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

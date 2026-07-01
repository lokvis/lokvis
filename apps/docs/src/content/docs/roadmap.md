---
title: Roadmap
description: Lokvis development roadmap across four phases.
draft: false
head: []
---

# Roadmap

See `docs/whitepaper/07-路线图与里程碑.md` for the full plan.

## Phase 1 — MVP (Months 1-3)

**Focus:** Image Workspace

- Image format conversion (png/jpeg/webp/avif/gif)
- Image compression (target size / quality)
- Resize / crop / rotate / flip
- Watermark (text + image)
- Batch processing
- 5-step linear workflow editor
- 50 SEO landing pages
- PWA installable

## Phase 2 — Expansion (Months 4-6)

- Video Workspace (ffmpeg.wasm)
- PDF Workspace (pdf-lib)
- Audio Workspace (Web Audio API)
- **MCP Server v1 (new, P0)** — expose Lokvis capabilities to Claude / ChatGPT / Cursor via the Model Context Protocol. See [MCP Integration](./mcp).
- Plugin SDK v1 → **downgraded to Alpha**; MCP-first. Marketplace → free community sharing.
- User accounts & sync

## Phase 3 — Intelligence (Months 7-9)

- AI workflow generation
- OCR / caption / background removal
- Multi-device sync via Durable Objects
- Marketplace public launch

## Phase 4 — Platform (Months 10-12)

- Public Plugin SDK + Marketplace
- Branching workflows (DAG)
- API access for developers
- Enterprise tier

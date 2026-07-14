# Example: Lokvis MCP Server + Cursor

This example shows how to configure Cursor to use Lokvis's local file-processing capabilities via the Model Context Protocol — without leaving the editor.

> **Status:** Phase 2 M2.4. End-to-end verified against the `@lokvis/mcp-server` package. See [`demo/test-prompts.md`](./demo/test-prompts.md) and the [Phase 2 blog post](../../docs/blog/2026-07-15-mcp-first-local-tools.md) for the verified demo workflow.

## Why Cursor + Lokvis?

Cursor already shines at code edits, but image assets in a repo (screenshots, og-images, favicons, marketing banners) still pull you out of the editor — typically into a web tool that uploads the file. With Lokvis wired into Cursor's MCP support, you can ask the agent to compress the screenshots in your docs folder, regenerate favicons at multiple sizes, or batch-convert PNGs to WebP. Files stay on disk; nothing is uploaded.

## Prerequisites

- Cursor (latest stable; MCP support is in active development — confirm your build supports `~/.cursor/mcp.json`)
- Node.js 20+ (for `npx`)
- Images to process (in `demo/` or any folder under `LOKVIS_WORKDIR`)

## Setup

### 1. Copy the config

Edit `~/.cursor/mcp.json` (create it if missing). Use [`cursor_config.json`](./cursor_config.json) as a starting point:

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/your-username/Projects",
        "LOKVIS_DOMAINS": "image",
        "LOKVIS_MODE": "stdio"
      }
    }
  }
}
```

Adjust `LOKVIS_WORKDIR` to the directory you want Lokvis to read/write files in. For a repo-scoped setup, point it at the repository root.

### 2. Restart Cursor

Quit Cursor completely and reopen it. In the Chat / Composer panel, open the tool picker — the `lokvis_image_*` tools should appear.

### 3. Try the test prompts

Open [`demo/test-prompts.md`](./demo/test-prompts.md) and paste each prompt into Cursor's Chat. Reference a path inside `LOKVIS_WORKDIR` (e.g. `assets/hero.png`).

## Test Prompts

See [`demo/test-prompts.md`](./demo/test-prompts.md) for the full list. Highlights, optimised for a code repo context:

1. **"Compress all screenshots in `docs/` to under 200KB"** → `lokvis_image_compress` (per file)
2. **"Generate 32×32 and 16×16 favicons from `public/icon.svg`"** → `lokvis_image_resize` (×2)
3. **"Convert every PNG in `public/og/` to WebP, quality 85"** → `lokvis_image_convert` (per file)

## Demo image

Some prompts reference `demo/sample-image.jpg`, which is **not** committed (binary asset). Drop your own test image there before running the prompts. A suitable test image:

- Resolution: 1920×1080 or larger
- Format: JPG
- Size: 500KB–2MB
- Content: a photo with a clear subject (useful for compress / resize visibility testing)

You can use any royalty-free image, e.g. from [Unsplash](https://unsplash.com/).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Tools don't appear in the picker | Cursor build predates MCP support, or config JSON is malformed | Update Cursor; validate JSON with `cat ~/.cursor/mcp.json \| jq .` |
| "Tool not available" | `LOKVIS_DOMAINS` doesn't include the capability's domain | Add `image`, `pdf`, etc. to `LOKVIS_DOMAINS` |
| "Browser not connected" | Capability requires browser (video/audio, OPFS large files) | Open `lokvis.app` in a browser tab and connect via BrowserBridge |
| "File too large" | File >10MB and no browser connected | Open `lokvis.app` and grant directory access via File System Access API |
| `npx` fails to fetch package | Network / registry issue | Pre-install: `npm install -g @lokvis/mcp-server` |
| Output files written outside repo | `LOKVIS_WORKDIR` is wider than the repo | Set `LOKVIS_WORKDIR` to the repo root, or pass absolute `output_path` |

## Learn More

- [MCP Integration docs](../../apps/docs/src/content/docs/mcp.mdx)
- [Phase 2 blog post — MCP-first local tools](../../docs/blog/2026-07-15-mcp-first-local-tools.md)
- [AI 生态冲击调整方案](../../docs/AI生态冲击调整方案.md) — strategic context
- [MCP protocol spec](https://modelcontextprotocol.io/)

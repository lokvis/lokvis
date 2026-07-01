# Example: Lokvis MCP Server + Claude Desktop

This example shows how to configure Claude Desktop to use Lokvis's local file-processing capabilities via the Model Context Protocol.

> **Status:** Phase 2. The `@lokvis/mcp-server` package skeleton is in this repo; Claude Desktop integration testing happens in Phase 2 W9-W10. See [`docs/AI生态冲击调整方案.md`](../../docs/AI生态冲击调整方案.md) §9.1.

## Prerequisites

- Claude Desktop app (macOS / Windows / Linux)
- Node.js 20+ (for `npx`)
- Images to process (in `demo/` or your own directory)

## Setup

### 1. Copy the config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) — on other platforms see the [Claude Desktop docs](https://modelcontextprotocol.io/quickstart). Use [`claude_config.json`](./claude_config.json) as a starting point:

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/your-username/Documents",
        "LOKVIS_DOMAINS": "image",
        "LOKVIS_MODE": "stdio"
      }
    }
  }
}
```

Adjust `LOKVIS_WORKDIR` to the directory you want Lokvis to read/write files in.

### 2. Restart Claude Desktop

Quit Claude Desktop completely and reopen it. The Lokvis tools will appear in the tool picker.

### 3. Try the test prompts

Open [`demo/test-prompts.md`](./demo/test-prompts.md) and paste each prompt into Claude. Drop `demo/sample-image.jpg` into the chat (or reference a path inside `LOKVIS_WORKDIR`).

## Test Prompts

See [`demo/test-prompts.md`](./demo/test-prompts.md) for the full list:

1. **"Compress this image to under 100KB"** → `lokvis_compress_image`
2. **"Resize all images in /photos to 1920px width"** → `lokvis_batch_process` (resize)
3. **"Convert image.png to WebP"** → `lokvis_convert_image`
4. **"Add watermark 'Confidential' to bottom-right"** → `lokvis_watermark_image` *(Phase 2 计划,尚未实现)*
5. **"Run my web-optimize workflow on this image"** → `lokvis_run_workflow`

## Demo image

Some prompts reference `demo/sample-image.jpg`, which is **not** committed (binary asset). Place your own test image there before running the prompts. A suitable test image:

- Resolution: 1920x1080 or larger
- Format: JPG
- Size: 500KB - 2MB
- Content: a photo with a clear subject (useful for compress / resize / watermark visibility testing)

You can use any royalty-free image, e.g. from [Unsplash](https://unsplash.com/).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Tool not available" | `LOKVIS_DOMAINS` doesn't include the capability's domain | Add `image`, `pdf`, etc. to `LOKVIS_DOMAINS` |
| "Browser not connected" | Capability requires browser (video/audio, OPFS large files) | Open `lokvis.app` in a browser tab |
| "File too large" | File >10MB and no browser connected | Open `lokvis.app` and grant directory access via File System Access API |
| `npx` fails to fetch package | Network / registry issue | Pre-install: `npm install -g @lokvis/mcp-server` |

## Learn More

- [MCP Integration docs](../../apps/docs/src/content/docs/mcp.mdx)
- [AI 生态冲击调整方案](../../docs/AI生态冲击调整方案.md) — strategic context
- [MCP protocol spec](https://modelcontextprotocol.io/)

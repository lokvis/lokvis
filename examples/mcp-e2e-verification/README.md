# Example: Lokvis MCP Server E2E Verification (M2.4 demo)

This is the **verifiable demo deliverable** for task [M2.4](../../docs/reports/archive/20260712-task-plan.md) — Claude Desktop / Cursor 端到端验证.

The script does, end-to-end, what a human would do by clicking through Claude Desktop or Cursor:

1. Starts the Lokvis MCP server (`@lokvis/mcp-server`) on a random SSE port
2. Connects an MCP SDK `Client` via `SSEClientTransport`
3. Calls `listTools` — asserts all 3 `lokvis_image_*` tools are registered
4. Calls `lokvis_image_resize` — asserts the output file is the right size
5. Calls `lokvis_image_compress` — asserts the output file exists
6. Calls `lokvis_image_convert` — asserts the output format is `webp`
7. Prints a pass/fail summary, tears down client + server + temp dir

Exit code `0` = all green, `1` = any assertion failed.

## Why a script (not a screen recording)?

The M2.4 task brief asks for "2 demos + 1 blog post." Screen recordings are great narrative, but they're not regression-proof: a future refactor can silently break the Claude Desktop flow and the recording still looks fine. This script is the **regression-proof demo** — run it on every release and you've re-verified M2.4. The blog post ([`docs/blog/2026-07-15-mcp-first-local-tools.md`](../../docs/blog/2026-07-15-mcp-first-local-tools.md)) supplies the narrative layer on top.

## Prerequisites

- Built workspace: `pnpm build` from repo root (builds `@lokvis/mcp-server`'s `dist/`)
- `sharp` system dependencies (libvips — usually bundled in the prebuilt binary)

## Run

```bash
# from repo root
pnpm install
pnpm build
pnpm --filter @lokvis/example-mcp-e2e-verification verify
```

Expected output (abbreviated):

```
=== Lokvis MCP Server 端到端验证(M2.4 demo)===

workdir: /tmp/lokvis-e2e-XYZ
sample:  /tmp/lokvis-e2e-XYZ/sample.png (200×100 PNG)

mcp-server SSE 监听 http://127.0.0.1:PORT/sse
已注册 tools: lokvis_image_resize, lokvis_image_compress, lokvis_image_convert

步骤 1: listTools(验证 3 个 image tool 已注册)
  ✓ PASS  listTools 返回 3 个 lokvis_image_* tool

步骤 2: callTool lokvis_image_resize(200×100 → 100×50)
  ✓ PASS  resize 输出尺寸 100×50

步骤 3: callTool lokvis_image_compress(quality 30)
  ✓ PASS  compress 输出文件已生成

步骤 4: callTool lokvis_image_convert(PNG → WebP)
  ✓ PASS  convert 输出格式为 webp

=== 汇总 ===
  ✓ listTools 返回 3 个 lokvis_image_* tool
  ✓ resize 输出尺寸 100×50
  ✓ compress 输出文件已生成
  ✓ convert 输出格式为 webp

✓ M2.4 端到端验证通过:3 个 image tool 全部正常工作
```

## What this verifies

| Layer | Verified by |
|---|---|
| `@lokvis/mcp-server` factory `createLokvisMcpServer` boots cleanly | step 2 |
| `McpServerAdapter` registers tools via `setRequestHandler` | step 1 |
| `LokvisSseServer` accepts an SDK `Client` over real HTTP | step 3 |
| `listTools` RPC returns the 3 image tools | step 1 |
| `lokvis_image_resize` produces a correctly-sized output file | step 2 |
| `lokvis_image_compress` produces an output file with size info | step 3 |
| `lokvis_image_convert` produces a WebP-format output | step 4 |
| `ToolRouter` correctly routes to the Node engine adapter when no browser is connected | steps 2–4 |

## What this does NOT verify

- The actual Claude Desktop / Cursor UI integration (those clients' MCP support, JSON config parsing, tool picker display, tool-use rendering). For that, follow [`examples/mcp-claude-desktop/`](../mcp-claude-desktop/README.md) and [`examples/mcp-cursor/`](../mcp-cursor/README.md) manually.
- BrowserBridge browser-side (a browser tab connecting via WebSocket and overriding the Node engine). The router falls back to Node engine here; M2.3's `browser-bridge.test.ts` covers the bridge path.

## CI integration

The script is safe to run in CI (random port, temp dir, fully self-contained). Suggested job:

```yaml
- run: pnpm build
- run: pnpm --filter @lokvis/example-mcp-e2e-verification verify
```

A non-zero exit fails the job. Treat this as the M2.4 release gate.

## Learn more

- [Phase 2 blog post](../../docs/blog/2026-07-15-mcp-first-local-tools.md)
- [M2.4 task brief](../../docs/reports/archive/20260712-task-plan.md)
- [Claude Desktop example](../mcp-claude-desktop/README.md) · [Cursor example](../mcp-cursor/README.md)

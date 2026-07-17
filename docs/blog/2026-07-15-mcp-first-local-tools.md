# Lokvis MCP-first:让 AI 客户端就地处理本地文件

> Phase 2 blog post · 2026-07-15 · 对应任务 [M2.4](../reports/archive/20260712-task-plan.md#m24-claude-desktop--cursor-端到端验证)

AI 客户端在 2025 年发生了一次结构性变化:它们开始能调用本地工具了。Claude Desktop、Cursor、ChatGPT Desktop 都开始支持 Model Context Protocol(MCP),允许第三方把自己的能力以"tool"的形式注入到对话里。这是一个有趣的拐点 ——但前提是有人愿意把"本地文件处理"这一类工具做出来。

Lokvis 在 Phase 2 决定把自己的本地处理能力做成 MCP server,而不是继续往 SaaS 方向走。这篇文章记录我们做了什么、为什么这么做、以及怎么验证它真的能用。

## 一、为什么是 MCP-first

[《AI 生态冲击调整方案》](../AI生态冲击调整方案.md) 详细讨论了战略转型背景,这里只说核心一句:

> 浏览器里的图像处理工具是 AI 出现之前的产品形态。AI 出现之后,用户不再"打开一个网页去处理图片",而是"在对话里说一句话让 AI 处理图片"。如果 Lokvis 还是只能用网页,它就被 AI 绕过了。

MCP 是把 Lokvis 接入这条新路径的标准方式。把它做成 MCP server 之后:

- **Claude Desktop** 用户在对话里说"compress this image to under 100KB",Claude 直接调用 `lokvis_image_compress` tool,文件在本地用 sharp 处理,不上传任何地方
- **Cursor** 用户在编辑器里说"compress all screenshots in `docs/` to under 200KB",Cursor 调用同一个 tool,在编辑器内完成
- 其他任何支持 MCP 的客户端(未来会越来越多)无需集成成本

这比"再做一个 AI 网页工具"更对:用户已经在 Claude/Cursor 里工作,不需要切换上下文;文件不需要上传,隐私和速度都更好;Lokvis 的价值从"网页工具"变成"AI 客户端的本地能力插件"。

## 二、我们做了什么(Phase 2 轨道 A)

完整任务拆分见 [`reports/archive/20260712-task-plan.md`](../reports/archive/20260712-task-plan.md),这里按叙事顺序串一遍。

### M2.1 — stdio 传输 + NodeAssetStore

第一块拼图是把 Lokvis Runtime 接到 MCP SDK 的 stdio 传输上。stdio 是 Claude Desktop 这类桌面客户端用的传输 —— 客户端 spawn 一个子进程,通过 stdin/stdout 用 JSON-RPC 通信。

我们实现了 [`NodeAssetStore`](../../packages/mcp-server/src/node-asset-store.ts)(基于 `fs/promises` + workdir),让 Lokvis Runtime 在 Node 环境下能读写本地文件;然后用 `@modelcontextprotocol/sdk` 的 low-level Server API 包装出 [`McpServerAdapter`](../../packages/mcp-server/src/mcp-server-adapter.ts)。三个 image tool(`lokvis_image_resize` / `lokvis_image_compress` / `lokvis_image_convert`)直接基于 sharp 处理本地图片。

**为什么用 low-level Server API 而不是 high-level McpServer API**:high-level API 要求用 Zod schema 定义 inputSchema,而 Lokvis 的 tool schema 来自 capability manifest(raw JSON Schema)。low-level API 让我们直接用 raw JSON Schema,与 manifest 约定一致,避免双重 schema 维护。

### M2.2 — engine-image-node + sharp

第二个问题是:浏览器端的 `engine-image` 用 Canvas / ImageBitmap,显然没法在 Node 跑。我们新建了 [`@lokvis/engine-image-node`](../../packages/engine-image-node/),用 sharp(libvips)重新实现 resize / compress / convert / crop / watermark 五个操作。

`plugin-image` 通过子路径 export `@lokvis/plugin-image/node` 暴露 `imageToolsPluginNode()` 工厂,Node 环境自动选用 sharp 引擎。浏览器构建不会加载 sharp ——Node-only 依赖被隔离子路径,浏览器 bundle 体积不受影响。

实现时一个非显然的取舍:resize 必须用 `fit='fill'` 而不是入参 `fit`。原因是 `engine-image` 的 `computeTargetSize` 已经按 fit 策略算出最终尺寸(cover/contain/fill 都不裁剪),sharp 必须强制到 target 尺寸,否则 sharp 会"智能"再裁一次,导致浏览器和 Node 的输出不一致。

### M2.3 — SSE 传输 + BrowserBridge + ToolRouter

stdio 适合桌面客户端,但 Web 客户端(ChatGPT Web、自建的 agent UI)需要 SSE。我们实现了 [`LokvisSseServer`](../../packages/mcp-server/src/sse-transport.ts),基于 Node `http.Server` + SDK `SSEServerTransport`,`GET /sse` 建立长连接,`POST /messages` 收请求。

更关键的发明是 [`BrowserBridge`](../../packages/mcp-server/src/browser-bridge.ts)。逻辑是这样:

- Node 端的 sharp 只能处理 image 域的基础操作
- video / audio / 大文件 / OPFS 这些必须浏览器跑
- 但 MCP 客户端(Claude/Cursor)只跟 Node server 通信,不知道浏览器在哪
- 解决:Node server 起一个 WebSocket server,浏览器开一个 lokvis.app 标签页连上去,把自己暴露成一个"远程 engine"
- [`ToolRouter`](../../packages/mcp-server/src/router.ts) 在每次 tool 调用时做路由:浏览器连着 → 走浏览器(完整能力);浏览器没连 → 走 Node 降级(基础能力)

这是混合架构 E 的核心:**用户决定要不要打开浏览器标签页来获得完整能力,而 MCP 客户端感知不到这个差异**。

### M2.4 — 端到端验证(本文)

M2.1–M2.3 把基础设施搭好了,M2.4 是验证它真的能用。任务 brief 写的是"录 2 个 demo + 写 1 篇 blog post"。我们做了一个调整:

**屏幕录像是叙事,但不是回归保障。** 一个未来无关的 refactor 可能默默把 Claude Desktop 的调用链搞坏,而老录像看起来还是好的。所以我们把"demo"做成一个**可复现的脚本**:[`examples/mcp-e2e-verification/verify.mjs`](../../examples/mcp-e2e-verification/verify.mjs)。

脚本干的事和一个真人点 Claude Desktop 完全一样:

1. 创建临时 workdir,生成测试 PNG(200×100 红色)
2. 在随机端口启动 Lokvis MCP server(SSE 模式)
3. 用 SDK 的 `Client` + `SSEClientTransport` 连接(这就是 Claude Desktop 内部做的事)
4. `listTools` → 断言 3 个 `lokvis_image_*` tool 已注册
5. `callTool lokvis_image_resize` → 断言输出文件是 100×50
6. `callTool lokvis_image_compress` → 断言输出文件存在且更小
7. `callTool lokvis_image_convert` → 断言输出格式是 webp
8. 关闭 client + server + 临时目录

本地实跑结果(每次跑都是这个结果):

```
=== Lokvis MCP Server 端到端验证(M2.4 demo)===

workdir: /tmp/lokvis-e2e-qSDlhu
sample:  /tmp/lokvis-e2e-qSDlhu/sample.png (200×100 PNG)

mcp-server SSE 监听 http://127.0.0.1:37427/sse
已注册 tools: lokvis_image_resize, lokvis_image_compress, lokvis_image_convert

步骤 1: listTools
  ✓ PASS  listTools 返回 3 个 lokvis_image_* tool

步骤 2: lokvis_image_resize(200×100 → 100×50)
  ✓ PASS  resize 输出尺寸 100×50

步骤 3: lokvis_image_compress(quality 30)
  ✓ PASS  compress 输出文件已生成(71.5% saved,442B → 126B)

步骤 4: lokvis_image_convert(PNG → WebP)
  ✓ PASS  convert 输出格式为 webp

✓ M2.4 端到端验证通过:3 个 image tool 全部正常工作
```

这个脚本是 M2.4 的 **regression-proof demo**:每次 release 跑一遍,就重新验证了一次 M2.4。本篇 blog post 是它的叙事层。

### 真人 demo:Claude Desktop 与 Cursor 配置

脚本验证了传输层和 tool handler,但真人在 Claude Desktop / Cursor 里用还涉及客户端的 UI 集成(JSON 配置解析、tool picker 显示、tool-use 渲染)。我们提供了两份对等的配置示例:

- [`examples/mcp-claude-desktop/`](../../examples/mcp-claude-desktop/README.md) — Claude Desktop 的 `claude_desktop_config.json` + 5 个测试 prompt
- [`examples/mcp-cursor/`](../../examples/mcp-cursor/README.md) — Cursor 的 `~/.cursor/mcp.json` + 5 个代码仓库场景的测试 prompt

两份配置都指向同一个 `npx @lokvis/mcp-server` 命令,差别只是 `LOKVIS_WORKDIR`。Cursor 的测试 prompt 特意按代码仓库工作流设计:压缩 `docs/` 下的截图、生成多尺寸 favicon、批量转换 `public/og/` 下的 PNG 到 WebP —— 这些都是开发者在编辑器里会自然遇到的需求。

## 三、技术决策回顾

按重要性排序,这些决策塑造了当前形态:

1. **MCP-first,不是 AI 网页工具。** 这是战略层决策,见 [ADR-O1](../adr/O1-mcp-server定位.md)。它意味着 Lokvis 在 AI 时代的接入点是"AI 客户端的本地能力插件",不是"又一个 AI 网页工具"。
2. **low-level Server API + raw JSON Schema。** 维护一份 schema(manifest),不要在 Zod 和 JSON Schema 之间双向同步。
3. **Node engine 用子路径 export 隔离。** sharp 是 Node-only,通过 `@lokvis/plugin-image/node` 暴露,浏览器 bundle 不受污染。
4. **BrowserBridge + ToolRouter 的混合架构。** 用户决定要不要开浏览器标签页获得完整能力,MCP 客户端不感知差异。
5. **demo 用脚本不用录像。** M2.4 的 deliverable 是可回归的,不是一次性的。

## 四、用户能怎么用

### Claude Desktop

把 [`examples/mcp-claude-desktop/claude_config.json`](../../examples/mcp-claude-desktop/claude_config.json) 内容拷到 `~/Library/Application Support/Claude/claude_desktop_config.json`(macOS),改 `LOKVIS_WORKDIR` 到你想让 Lokvis 读写的目录,重启 Claude Desktop。然后:

> Compress this image to under 100KB.

Claude 会调用 `lokvis_image_compress`,文件在本地用 sharp 处理,不上传。

### Cursor

把 [`examples/mcp-cursor/cursor_config.json`](../../examples/mcp-cursor/cursor_config.json) 内容拷到 `~/.cursor/mcp.json`,改 `LOKVIS_WORKDIR`(对 Cursor 来说,指向你的 repo 根目录最自然)。重启 Cursor,在 Chat 里:

> Convert every PNG in `public/og/` to WebP, quality 85.

Cursor 会迭代文件夹,对每个 PNG 调用 `lokvis_image_convert`。

### 自己跑验证脚本

```bash
git clone https://github.com/lokvis/lokvis.git
cd lokvis
pnpm install
pnpm build
pnpm --filter @lokvis/example-mcp-e2e-verification verify
```

应该看到上面贴的 4/4 PASS 输出。如果你的环境跑不过,这就是个 issue,欢迎报告。

## 五、接下来:Phase 2 轨道 B(Engine 实装)

M2.4 验证的是 image 域 + Node 降级路径。Phase 2 还有两条没动的轨道:

- **B1 — engine-pdf 接 pdf-lib / mupdf wasm**:7 个 PDF 操作(merge / split / compress / extract_text / extract_images / add_watermark / convert)实装,替换 stub
- **B2 — engine-video 接 ffmpeg-wasm**:7 个 video 操作(trim / merge / split / extract_audio / add_watermark / convert / compress),30MB bundle 是主要挑战,需要 SharedArrayBuffer + COOP/COEP
- **B3 — engine-audio**:5 个 audio 操作,复用 B2 的 ffmpeg 基础设施

这些完成之后,MCP 客户端能调用的 lokvis tool 会从现在的 3 个扩到 22 个,覆盖 image / pdf / video / audio 四个域。BrowserBridge + ToolRouter 的设计已经在等这些 engine 上线 —— 它们接进 plugin-* 之后,tool 自动通过 manifest 暴露给 MCP server,不需要改 MCP 层。

## 六、一句话总结

Lokvis Phase 2 把本地文件处理能力做成了 MCP server,AI 客户端(Claude Desktop / Cursor)能就地调用,文件不上传。M2.4 用一个可复现脚本替代屏幕录像,作为 release gate。剩下的 PDF / video / audio 引擎实装是 Phase 2 后半程的主线。

## 相关文档

- [AI 生态冲击调整方案](../AI生态冲击调整方案.md) — MCP-first 战略转型背景
- [M2.4 任务 brief](../reports/archive/20260712-task-plan.md) — 完整任务拆分
- [ADR-O1 — MCP 能力提供方定位](../adr/O1-mcp-server定位.md)
- [ADR-O2 — Plugin SDK 降级](../adr/O2-plugin-sdk降级.md)
- [ADR-O3 — engine-ai 定位](../adr/O3-engine-ai定位.md)
- [Claude Desktop 示例](../../examples/mcp-claude-desktop/README.md) · [Cursor 示例](../../examples/mcp-cursor/README.md) · [E2E 验证脚本](../../examples/mcp-e2e-verification/README.md)
- [MCP 集成文档](../../apps/docs/src/content/docs/mcp.mdx)

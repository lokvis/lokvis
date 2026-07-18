# @lokvis/mcp-server

> 把 Lokvis Runtime 的本地处理能力暴露给 AI 客户端(Claude / ChatGPT / Cursor)。

Lokvis 是"AI 时代的本地处理引擎"。这个包把浏览器内的本地文件处理能力(WASM/Canvas/OPFS)包装为 MCP(Model Context Protocol)server,让 AI Agent 能安全、免费、批量地处理本地文件——文件不上传,隐私不泄露。

## 状态:Phase 1(C 组已完成,5 个 tool 可用)

当前仓库提供:

- `createLokvisMcpServer()` 工厂与 `LokvisMcpOptions` 配置接口(见 `src/index.ts`)
- `LokvisMcpTransport` 抽象传输层接口(stdio / SSE 双模式)
- `ToolRouter` 路由逻辑(浏览器优先,Node 降级)
- 5 个已实现的 tool(3 image + 2 pdf)
- `CloudAuthenticator` API Key 鉴权(可选)
- `CloudBilling` plan 级别配额控制(cloud AI tool 用)

## 架构(混合模式 E,推荐)

```
AI 客户端(Claude Desktop / Cursor)
        │ MCP 协议(JSON-RPC over stdio)
        ▼
@lokvis/mcp-server(Node.js 进程)
  ├── ToolRouter:浏览器优先,Node 降级
  └── 传输层:stdio / SSE
        │
        ├── WebSocket → 浏览器 Tab(lokvis.app)
        │             └── Lokvis Runtime(WASM/Canvas/OPFS,完整能力)
        │
        └── 直接调用 → Node Engine Adapter(sharp / pdf-lib,降级模式)
```

详见 `docs/AI生态冲击调整方案.md` §3 与附录 A 的五种架构对比。

## 快速开始

### 1. 安装

```bash
npm install @lokvis/mcp-server
# 或通过 npx 免安装运行
npx @lokvis/mcp-server
```

### 2. Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/you/Documents"
      }
    }
  }
}
```

### 3. Cursor 配置

编辑 `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server@latest"]
    }
  }
}
```

## 可用 Tools

| Tool | 描述 | 示例 |
|---|---|---|
| `lokvis_image_compress` | 本地压缩图片(质量/格式) | "Compress image.jpg to 80% quality" |
| `lokvis_image_resize` | 本地调整尺寸(宽高/缩放策略) | "Resize image.png to 800px width" |
| `lokvis_image_convert` | 格式转换(JPEG/PNG/WebP/AVIF) | "Convert PNG to WebP" |
| `lokvis_pdf_merge` | 合并多个 PDF 文件 | "Merge report.pdf and appendix.pdf" |
| `lokvis_pdf_compress` | 压缩 PDF(对象流压缩) | "Compress large.pdf to reduce size" |

## 运行模式

### stdio 模式(默认,推荐)

适用于 Claude Desktop / Cursor 等桌面客户端。

### SSE 模式(实验性,Phase 2.5+)

适用于 Web 端 AI 客户端集成。

## 设计文档

- [AI 生态冲击调整方案](../../docs/AI生态冲击调整方案.md) — 战略背景与完整设计
- [Plugin SDK vs MCP Server](../../apps/docs/src/content/docs/plugins.md) — 两种扩展方式对比

## License

MIT

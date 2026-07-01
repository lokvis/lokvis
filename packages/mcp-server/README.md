# @lokvis/mcp-server

> 把 Lokvis Runtime 的本地处理能力暴露给 AI 客户端(Claude / ChatGPT / Cursor)。

Lokvis 是"AI 时代的本地处理引擎"。这个包把浏览器内的本地文件处理能力(WASM/Canvas/OPFS)包装为 MCP(Model Context Protocol)server,让 AI Agent 能安全、免费、批量地处理本地文件——文件不上传,隐私不泄露。

## 状态:Phase 2 P0(骨架已就绪,实现进行中)

当前仓库提供:

- `createLokvisMcpServer()` 工厂与 `LokvisMcpOptions` 配置接口(见 `src/index.ts`)
- `LokvisMcpTransport` 抽象传输层接口(stdio / SSE)
- `ToolRouter` 路由逻辑骨架(浏览器优先,Node 降级)
- `LokvisMcpServer` 接口定义(server 注册 tools/resources/prompts 的契约)

实际 MCP server 启动、tool 实现(image compress/resize/batch)、Claude Desktop 集成测试将在 Phase 2 W3-W12 完成(见 `docs/AI生态冲击调整方案.md` §3.12)。

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

## 可用 Tools(Phase 2 完成后)

| Tool | 描述 | 示例 |
|---|---|---|
| `lokvis_compress_image` | 本地压缩图片(目标大小/质量/格式) | "Compress image.jpg to <100KB" |
| `lokvis_resize_image` | 本地调整尺寸(预设/自定义) | "Resize to 1920x1080" |
| `lokvis_convert_image` | 格式转换(WebP/AVIF/PNG/JPEG) | "Convert PNG to WebP" |
| `lokvis_batch_process` | 批量处理(最多 100 文件) | "Compress all images in /photos" |
| `lokvis_run_workflow` | 执行已保存的 workflow | "Run my web-optimize workflow" |

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

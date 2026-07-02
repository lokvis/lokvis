# MCP 集成

> 将 Lokvis 能力暴露给 AI 客户端（Claude Desktop / ChatGPT / Cursor / Windsurf）
> 文件留在本地，不上传任何东西。

---

## 为什么需要 MCP？

2026 年 AI 生态发生结构性变化：MCP 成为工具集成的事实标准，AI Agent 可自主编排一次性任务。Lokvis 定位为**AI 的本地执行引擎**——处理 AI 不擅长的事：

| AI 短板 | Lokvis 优势 |
|---------|-------------|
| 批量处理 100+ 文件 | 并发 4，稳定完成 |
| 大文件（>50MB 视频） | 本地 WASM，无限制 |
| 隐私敏感场景 | 文件不出浏览器 |
| 确定性执行 | Workflow 每次结果一致 |
| 离线场景 | PWA 完整离线 |
| 精细参数控制 | DPI / EXIF / 色彩空间 |

---

## 架构

Lokvis 使用**混合架构（Mode E）**：浏览器优先，Node.js 降级。

```
AI Client（Claude Desktop / ChatGPT / Cursor）
    │ MCP Protocol（JSON-RPC over stdio）
    ▼
@lokvis/mcp-server（Node.js）
    │ WebSocket        │ 直接调用
    ▼                  ▼
浏览器 Tab           Node.js Engine
（Lokvis Runtime）    （sharp / pdf-lib）
（WASM/Canvas/OPFS）  （降级模式）
```

### 模式 1：浏览器连接（完整能力）

用户打开了 `lokvis.app` 浏览器 Tab 时，MCP server 通过 WebSocket 转发 tool 调用到浏览器 Runtime。

**能力**：WASM/Canvas/OPFS/WebCodecs 完整支持

### 模式 2：Node.js 降级（基础能力）

浏览器未连接时，MCP server 直接在 Node.js 中使用 `sharp`（图像）和 `pdf-lib`（PDF）。

**能力降级矩阵**：

| 能力 | 浏览器模式 | Node 降级 |
|------|-----------|----------|
| `image.compress` | Canvas + WebP | ✅ sharp |
| `image.resize` | Canvas | ✅ sharp |
| `image.convert` | Canvas | ✅ sharp |
| `image.watermark` | Canvas | ✅ sharp + 叠加 |
| `image.crop` | Canvas | ✅ sharp |
| `pdf.merge` | pdf-lib | ✅ pdf-lib（相同） |
| `video.*` | ffmpeg.wasm | ❌ 不支持 |
| `audio.*` | Web Audio | ❌ 不支持 |
| 批量处理 | ✅ | ✅ |

**ToolRouter** 自动选择路径：浏览器优先 → Node 降级 → 不支持则报错。

---

## Quick Start

### 1. 安装

```bash
npm install @lokvis/mcp-server
# 或无需安装直接运行
npx @lokvis/mcp-server
```

### 2. Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）：

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

编辑 `~/.cursor/mcp.json`：

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

重启 AI 客户端后，Lokvis tools 自动可用。

---

## 可用 Tools

| Tool | 说明 | 示例 prompt |
|------|------|-------------|
| `lokvis_compress_image` | 本地压缩图片 | "Compress image.jpg to under 100KB" |
| `lokvis_resize_image` | 调整尺寸 | "Resize to 1920x1080" |
| `lokvis_convert_image` | 格式转换 | "Convert PNG to WebP" |
| `lokvis_batch_process` | 批量处理（最多 100 文件） | "Compress all images in /photos" |
| `lokvis_run_workflow` | 执行已保存的 workflow | "Run my web-optimize workflow" |

---

## Resources

MCP server 还暴露两个 MCP Resources：

| URI | 说明 |
|-----|------|
| `lokvis://capabilities` | 所有可用能力的 JSON 列表 |
| `lokvis://workflows` | 已保存 workflow 的 JSON 列表 |

---

## 运行模式

### stdio 模式（推荐）

适用于桌面 AI 客户端（Claude Desktop / Cursor / Windsurf）。server 从 stdin 读取 JSON-RPC 请求，向 stdout 写入响应。

### SSE 模式（实验性，Phase 2.5+）

适用于 Web 端 AI 客户端。server 暴露 HTTP/SSE 端点。状态：实验性，依赖 MCP Web 生态成熟度。

---

## 安全模型

| 威胁 | 缓解措施 |
|------|----------|
| 恶意 MCP client 窃取文件 | Tool 白名单；文件路径限制在工作目录；拒绝 `..` 路径 |
| 本地其他进程连接 WebSocket | origin 校验（仅 `lokvis.app`）+ 连接 token |
| 浏览器 Tab 被恶意页面控制 | WebSocket 仅接受 `lokvis.app` origin |
| AI 调用危险操作 | 危险 tool 需用户在浏览器确认 |
| Node 降级 `sharp` RCE | 成熟库 + Zod 校验参数 |

---

## 包结构

```
packages/mcp-server/
├── src/
│   ├── index.ts              # 公共入口：createLokvisMcpServer()
│   ├── server.ts             # MCP server 核心
│   ├── tools/
│   │   ├── image.ts          # 图片处理 tools
│   │   ├── pdf.ts            # PDF tools（Phase 2.5+）
│   │   ├── workflow.ts       # workflow 执行 tool
│   │   └── asset.ts          # asset 管理 tools
│   ├── resources/
│   │   ├── capabilities.ts   # 能力列表 resource
│   │   └── workflows.ts      # workflow 列表 resource
│   ├── prompts/
│   │   └── templates.ts      # 常见任务 prompt 模板
│   └── adapters/
│       ├── node-stdio.ts     # Node.js stdio 传输
│       ├── browser-sse.ts    # 浏览器 SSE 传输（Phase 2.5+）
│       └── node-engine.ts    # Node.js engine 适配（sharp）
```

---

## 实施时间线

| 阶段 | 任务 | 时机 |
|------|------|------|
| Phase 1 W11-W12 | MCP server 接口设计 + 传输架构评审 | 2026-09 |
| Phase 2 W1-W2 | 包骨架 + stdio 传输 + Node 降级引擎 | 2027-01 |
| Phase 2 W3-W4 | 浏览器 WebSocket 连接 + ToolRouter | 2027-01 |
| Phase 2 W5-W6 | image tools + 浏览器优先路由 | 2027-02 |
| Phase 2 W7-W8 | batch + workflow tools | 2027-02 |
| Phase 2 W9-W10 | resources + prompts + 集成测试 | 2027-03 |
| Phase 2 W11-W12 | npm 发布 + MCP registry | 2027-03 |

**Phase 2 MCP 总工时**：96h P0 + 12h P1

---

## 相关文档

- [AI 生态冲击调整方案](./AI生态冲击调整方案.md) — 完整战略背景与架构对比
- [插件开发](./plugins.md) — Plugin SDK vs MCP Server 对比
- [路线图](./roadmap.md) — Phase 2 MCP 里程碑

---

*本文档整合自 `apps/docs/src/content/docs/mcp.mdx` 与 AI 调整方案 §3。*

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

### 能力 Tool（对应单一 capability）

| Tool | 说明 | 示例 prompt |
|------|------|-------------|
| `lokvis_image_compress` | 本地压缩图片（质量/格式） | "Compress image.jpg to 80% quality" |
| `lokvis_image_resize` | 调整尺寸（宽高/缩放策略） | "Resize image.png to 800px width" |
| `lokvis_image_convert` | 格式转换（JPEG/PNG/WebP/AVIF） | "Convert PNG to WebP" |
| `lokvis_image_crop` | 裁剪（x/y/width/height） | "Crop image to 200x200 from top-left" |
| `lokvis_image_watermark` | 水印（文字/位置/透明度） | "Add '© 2026' watermark to bottom-right" |
| `lokvis_pdf_merge` | 合并多个 PDF 文件 | "Merge report.pdf and appendix.pdf" |
| `lokvis_pdf_compress` | 压缩 PDF（对象流压缩） | "Compress large.pdf to reduce size" |

> Tool 清单由 `runtime.toMcpManifest()` 自动生成，新增 capability 自动可见。命名约定：`lokvis_<domain>_<verb>`。

### 元 Tool（Runtime 级别操作）

这些 Tool 不对应单一 capability，而是 Runtime 级别操作：

| Tool | 说明 | 关键参数 |
|------|------|---------|
| `lokvis_run_workflow` | 执行完整工作流（多节点链） | `workflow`（Workflow JSON）、`inputAssetIds`（string[]） |
| `lokvis_get_asset` | 获取资产元数据（不返回二进制） | `assetId` |
| `lokvis_export_asset` | 导出资产为指定格式，返回本地文件路径 | `assetId`、`format`、`quality` |
| `lokvis_undo` / `lokvis_redo` | 历史栈操作 | `workflowId` |
| `lokvis_cancel` | 取消运行中的工作流 | `workflowId` |

**设计要点**：
- `lokvis_run_workflow` 是核心 Tool：AI 可构造完整 workflow（含多节点）一次执行
- 单 capability Tool 是便捷快捷方式，内部等价于单节点 workflow
- 二进制数据不通过 MCP 返回（避免阻塞 LLM 上下文）；改为返回 assetId + 本地文件路径

### 鉴权（可选）

设置 `LOKVIS_API_KEY` 环境变量可启用 cloud AI tool（未来扩展）。本地 tool（image/pdf）无需鉴权即可使用。

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/you/Documents",
        "LOKVIS_DOMAINS": "image,pdf",
        "LOKVIS_API_KEY": "lk_your_api_key_here"
      }
    }
  }
}
```

API Key 可在 https://app.lokvis.com/settings/api-keys 创建。

---

## Resources

MCP server 暴露以下 MCP Resources：

| URI | 说明 | MIME |
|-----|------|------|
| `lokvis://capabilities` | 所有可用能力的 JSON 列表（含 params JSON Schema） | application/json |
| `lokvis://workflows` | 已保存 workflow 的 JSON 列表（本地槽位） | application/json |
| `lokvis://asset/{id}/metadata` | 单个资产的元数据 | application/json |
| `lokvis://asset/{id}/thumbnail` | 缩略图 data URI | image/png |

**资源读取策略**：
- `lokvis://capabilities` 返回完整能力清单，供 AI 理解参数
- `lokvis://workflows` 返回本地保存的工作流槽位，供 AI 推荐复用
- 缩略图以 data URI 返回，避免文件系统访问；大图只返回 metadata

---

## Prompts（预定义提示模板）

MCP Prompts 是预定义的提示模板，AI 客户端可调用：

| Prompt | 说明 | 参数 |
|--------|------|------|
| `lokvis_optimize_for_web` | "优化这张图片用于网页" | `assetId`、`targetWidth`（默认 1920） |
| `lokvis_batch_social_resize` | "批量调整尺寸为社媒规格" | `assetIds[]`、`platform`（instagram/twitter/...） |
| `lokvis_add_watermark` | "给图片加水印" | `assetId`、`text`、`position` |
| `lokvis_compress_to_size` | "压缩到目标体积" | `assetId`、`targetKB` |

Prompt 模板返回自然语言 + 结构化 workflow JSON，AI 可直接调用 `lokvis_run_workflow` 执行，或调整参数后执行。

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
| 路径逃逸 | `lokvis_export_asset` 仅写入用户指定目录，禁止系统路径 |

---

## 设计决策（W12.8 评审）

> 2026-07-04 W12.8 评审通过，5 个开放问题全部决议。详见 [ADR-011](./adr/011-mcp-server.md)。

| # | 问题 | 决议 | 理由 |
|---|------|------|------|
| 1 | asset 传递方式 | **显式 `inputAssetIds`** | 隐式"当前选中资产"会造成状态耦合；显式传递符合 MCP 无状态约定 |
| 2 | workflow JSON 校验 | **强制 `validateWorkflow()` + 结构化错误** | 校验失败返回 `isError: true` + 修复建议，而非让 executor 抛运行时异常 |
| 3 | 历史栈共享 | **不共享，每个 stdio 进程独立 Runtime** | 避免跨会话状态污染，与"每个 MCP 连接独立进程"部署模型一致 |
| 4 | Pro 门控 | **尊重 `isPro`，batch 免费限 10 文件** | 门控在 Runtime 层而非 MCP 层，与 UI/CLI 一致 |
| 5 | 错误信息语言 | **英文** | MCP 客户端国际化友好，AI 可基于英文错误自主修复；中文保留在 description/prompts |

---

## open MCP vs cloud MCP

| 维度 | open MCP（stdio/SSE） | cloud MCP（HTTP） |
|------|----------------------|-------------------|
| 运行位置 | 用户本地 | cloud 服务器 |
| 文件处理 | 本地引擎（Canvas/WASM/sharp） | cloud 引擎（服务器侧） |
| 收费 | 免费 | Pro 订阅 |
| 能力范围 | 全部 capability | 子集（cloud 支持的） |
| Phase | Phase 2（已实现 stdio + SSE） | Phase 2.5+ |

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

*本文档整合自 `apps/docs/src/content/docs/mcp.mdx`、AI 调整方案 §3 及原 `mcp-design-draft.md`（W12.8 评审通过的接口设计草案，已合并于此）。*

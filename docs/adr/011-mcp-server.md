# ADR-011：新增 `@lokvis/mcp-server` 包

- **状态**：Proposed
- **日期**：2026-07-01
- **来源**：[AI 生态冲击调整方案](../AI生态冲击调整方案.md) §3

---

## 背景

2026 年 MCP（Model Context Protocol）成为 AI 工具集成的事实标准。Lokvis 需要将本地处理能力暴露给 AI 客户端（Claude Desktop / ChatGPT / Cursor），以定位为"AI 时代的本地处理引擎"。

MCP server 的能力提供方应在 open 侧（能力来源）而非 cloud 侧（商业化层），因为：
1. MCP server 依赖 `@lokvis/sdk` 和 `@lokvis/plugin-*`，这些都在 open 侧
2. MCP server 是开源能力（让 AI 调用本地处理），符合 MIT 许可

## 决策

在 `lokvis-open` 新增 `packages/mcp-server`，作为 MCP 协议的适配层。

### 架构选择

采用**混合架构（Mode E）**：浏览器优先，Node.js 降级。

五种候选架构对比详见 [AI 调整方案附录 A](../AI生态冲击调整方案.md#附录-a-mcp-传输架构方案对比)。

| 架构 | 描述 | 推荐度 |
|------|------|--------|
| A. Node Bridge + 浏览器 Runtime | Node.js 桥接 + WebSocket | ★★★★★ |
| B. 纯 Node.js MCP Server | sharp 替代 Canvas | ★★★ |
| C. 浏览器扩展 + Native Messaging | Chrome Extension 桥接 | ★★★★ |
| D. Service Worker + Tunnel | 公网 URL 转发 | ★★ |
| **E. 混合模式（A+B）** | **浏览器优先，Node 降级** | **★★★★★** |

### 包结构

```
packages/mcp-server/
├── src/
│   ├── index.ts              # createLokvisMcpServer()
│   ├── server.ts             # MCP server 核心
│   ├── tools/image.ts        # 图片处理 tools
│   ├── resources/            # capabilities / workflows
│   └── adapters/             # node-stdio / browser-sse / node-engine
```

## 理由

1. MCP server 依赖 `@lokvis/sdk`，放在 open 侧减少跨仓库依赖
2. 开源 MCP server 符合 MIT 许可，可吸引社区贡献
3. cloud 侧可选消费 `@lokvis/mcp-server` 用于 SSE 模式

## 后果

- open 侧新增一个包，维护成本增加
- 需处理 Node.js 环境下的 engine 适配（Canvas → sharp）
- `@modelcontextprotocol/sdk` 成为外部依赖
- Phase 2 W1-W12 实施，工时 96h P0 + 12h P1

## 关联

- [ADR-O1](./O1-mcp-server定位.md) — open 侧 MCP 角色定位
- [ADR-O2](./O2-plugin-sdk降级.md) — Plugin SDK 因此降级

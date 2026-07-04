# ADR-011：新增 `@lokvis/mcp-server` 包

- **状态**：Accepted
- **日期**：2026-07-01（Proposed）/ 2026-07-04（Accepted，W12.8 评审通过）
- **来源**：[AI 生态冲击调整方案](../AI生态冲击调整方案.md) §3
- **评审**：[MCP Server 接口设计草案](../mcp-design-draft.md)（W12.8 评审通过，5 个开放问题全部解决）

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

---

## W12.8 评审记录（2026-07-04）

### 评审范围

- [MCP Server 接口设计草案](../mcp-design-draft.md) v0.1（W11.10 草案）
- `packages/mcp-server` 现有骨架实现：`createLokvisMcpServer()` 工厂、`LokvisMcpServer` 接口、`LokvisMcpTransport` 抽象、`ToolRouter` 路由、`toolToCapability()` 反推（含 7 单测）
- `@lokvis/schema` `McpManifest` / `McpToolManifest` / `McpResourceManifest` 类型定义
- `@lokvis/runtime` `toMcpManifest({ batchMode })` 已实现

### 5 个开放问题的决议

草案 §10 列出的 5 个开放问题，经评审后决议如下：

| # | 问题 | 决议 | 理由 |
|---|---|---|---|
| 1 | asset 传递方式：显式 `inputAssetIds` vs 隐式"当前选中" | **显式 `inputAssetIds`** | 隐式上下文造成 MCP 客户端与服务端状态耦合；显式传递符合 MCP 无状态约定，便于 AI 理解与重放 |
| 2 | `lokvis_run_workflow` 内部是否强制 `validateWorkflow()` | **强制校验 + 结构化错误返回** | AI 生成的 workflow 可能不合法（环/孤儿节点/类型不匹配），入口处校验失败应返回结构化错误（含错误路径与修复建议），而非让 executor 抛运行时异常 |
| 3 | 多 AI 会话是否共享历史栈 | **不共享，每个 stdio 进程独立 Runtime** | 共享历史会引入跨会话状态污染与权限边界问题；独立 Runtime 与"每个 MCP 客户端连接独立进程"的部署模型一致 |
| 4 | MCP 是否尊重 `isPro` | **尊重，batch tool 免费模式限 10 文件** | 与 Workspace UI / CLI 的 Pro 门控一致；免费用户批量 10 文件上限，Pro 无限；门控在 Runtime 层而非 MCP 层 |
| 5 | tool 错误返回中文还是英文 | **英文** | MCP 客户端国际化更友好；AI 可基于英文错误信息自主修复策略；中文说明保留在 tool `description` 与 `prompts` 模板中 |

### 状态升级理由

1. **设计完整性**：草案覆盖 tools / resources / prompts / 传输 / 安全 / cloud 区别 / 实现路径 7 个维度，无设计空白
2. **骨架已落地**：`packages/mcp-server` 包已存在，包含接口抽象、路由骨架、单测；`@lokvis/schema` 类型已定义；`@lokvis/runtime` `toMcpManifest()` 已实现
3. **开放问题全部解决**：5 个开放问题均有明确决议，无悬而未决项
4. **实现路径清晰**：Phase 2 W1-W12（96h P0 + 12h P1）任务分解已就绪，工时已修正

### 实施前置条件（Phase 2 W1 启动时确认）

- [ ] `@modelcontextprotocol/sdk` 依赖引入（Phase 2 W1）
- [ ] Node engine adapter（sharp）依赖引入与许可证复核（Phase 2 W1）
- [ ] `lokvis_run_workflow` 校验失败时返回 MCP 兼容的错误结构（`isError: true` + text content 含修复建议）
- [ ] `lokvis_export_asset` 路径白名单实现（仅用户指定目录，禁止系统路径）

### 不变项

- 混合架构（Mode E：浏览器优先 + Node 降级）不变
- Phase 1 stdio 唯一传输不变
- tools / resources / prompts 清单与草案一致
- 安全策略（5 维度）不变

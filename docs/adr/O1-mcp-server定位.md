# ADR-O1：lokvis-open 作为 MCP 能力提供方

- **状态**：Proposed
- **日期**：2026-07-01
- **来源**：[AI 生态冲击调整方案](../AI生态冲击调整方案.md) §1.3

---

## 背景

2026 年 AI 生态转型后，Lokvis 需要从"独立工具平台"转向"AI 生态的本地外挂"。在这一新战略下，lokvis-open 仓库承担三个角色：

1. **本地处理引擎**：浏览器内 WASM/Canvas 处理能力
2. **MCP 能力提供方**：把本地能力包装为 MCP server，供 AI 调用
3. **AI 辅助 workflow 设计**：AI 生成/优化 workflow，但执行仍确定性

## 决策

lokvis-open 作为 MCP 能力提供方，通过 `@lokvis/mcp-server` 包将 Runtime 能力暴露给 AI 客户端。

### 影响矩阵

| 组件 | 影响 | 调整方向 |
|------|------|----------|
| `plugin-sdk` | 🔴 高 | 定位降级为兼容层 |
| `sdk` | 🟡 中 | 新增 `toMcpManifest()` API |
| `engine-ai` | 🟡 中 | 定位为"AI 辅助 workflow 设计" |
| `runtime` | 🟢 低 | 无需修改 |
| `capability` | 🟢 低 | 增加 MCP 兼容性元数据 |
| `schema` | 🟢 低 | Workflow 支持导出 AI 指令格式 |
| **新增 `mcp-server`** | 🔴 高 | 核心新包 |

### Phase 1 vs Phase 2 职责

| 能力 | Phase 1（open） | Phase 2（open） |
|------|----------------|----------------|
| MCP server 设计 | W11-W12 接口设计 | 实现 `@lokvis/mcp-server` |
| Plugin SDK | Alpha 预览 | 不发布 v1 |
| engine-ai | 维持 stub | cloudProxyEngine 接口 |
| Workflow 导出 | JSON 导入导出 | 支持导出 Claude Skill 指令 |

## 理由

1. MCP 成为事实标准，自建 Plugin 生态价值被稀释
2. Lokvis 的核心优势（批量/大文件/隐私/确定性/离线/精细参数）正是 AI 短板
3. 作为 MCP 能力提供方可触达所有 MCP 兼容客户端

## 后果

- 新增 `@lokvis/mcp-server` 包
- Plugin SDK 降级（见 [ADR-O2](./O2-plugin-sdk降级.md)）
- 营销从"替代 AI"转向"增强 AI"

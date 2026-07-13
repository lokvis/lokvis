# ADR-O1：lokvis-open 作为 MCP 能力提供方

- **状态**：Accepted
- **日期**：2026-07-01（Proposed）/ 2026-07-13（Accepted）
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

---

## 2026-07 review（Accepted 依据）

决策已落地，代码与 ADR 完全一致：

| 决策项 | ADR 承诺 | 实际代码状态 | 一致性 |
|--------|---------|-------------|--------|
| `@lokvis/mcp-server` 包 | 核心新包 | `packages/mcp-server/`（v0.2.2），含 `cli.ts` / `index.ts` / `router.ts` / `server.ts` 实装 | ✅ |
| MCP 能力提供方定位 | 把本地能力包装为 MCP server | `server.ts` 暴露 Runtime 能力，`router.ts` 实现工具路由 | ✅ |
| AI 客户端集成 | 供 AI 调用 | `examples/claude-desktop.md` + `examples/cursor.md` 集成示例 | ✅ |
| 测试覆盖 | — | `__tests__/router.test.ts` | ✅ |
| 与 ADR-011 一致 | — | ADR-011（`@lokvis/mcp-server` 包）已于 2026-07-04 Accepted，本 ADR 与其定位一致 | ✅ |

**结论**：决策方向正确，包已建立并具备基础实装。Phase 2（M2.1-M2.4）将完成 stdio 传输 + NodeAssetStore + Node Engine Adapter + 端到端验证，本 ADR 标记为 Accepted。

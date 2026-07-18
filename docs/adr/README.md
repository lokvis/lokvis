# 架构决策记录（ADR）索引

> Architecture Decision Records for lokvis-open。

---

## ADR 列表

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| [ADR-011](./011-mcp-server.md) | 新增 `@lokvis/mcp-server` 包 | Accepted | 2026-07-01（Proposed）/ 2026-07-04（Accepted） |
| [ADR-012](./012-商业资产迁出.md) | 商业化资产迁出至 lokvis-cloud | Accepted | 2026-07-02 |
| [ADR-013](./013-capability-manifest.md) | Capability Manifest 与 Codegen | Accepted | 2026-07-13（Proposed）/ 2026-07-15（Accepted） |
| [ADR-014](./014-plugin-dev-runtime-access.md) | plugin-dev 跨 Engine 层访问 ctx.runtime.\* 的例外 | Accepted | 2026-07-18 |
| [ADR-O1](./O1-mcp-server定位.md) | lokvis-open 作为 MCP 能力提供方 | Accepted | 2026-07-01（Proposed）/ 2026-07-13（Accepted） |
| [ADR-O2](./O2-plugin-sdk降级.md) | Plugin SDK 降级为兼容层 | Accepted | 2026-07-01（Proposed）/ 2026-07-13（Accepted） |
| [ADR-O3](./O3-engine-ai定位.md) | engine-ai 定位为 AI 辅助 workflow 设计 | Accepted | 2026-07-01（Proposed）/ 2026-07-13（Accepted） |

---

## 编号规则

- **ADR-0xx**：仓库级架构决策（影响包结构、部署、仓库边界）
- **ADR-Oxx**：AI 生态冲击调整相关决策（源自 [AI生态冲击调整方案](../AI生态冲击调整方案.md)）

---

## 相关文档

- [AI 生态冲击调整方案](../AI生态冲击调整方案.md) — 完整战略背景
- [PROJECT_PLAN.md](../PROJECT_PLAN.md) §14 变更记录 — 任务级调整明细

---

*ADR 格式参考 [Michael Nygard 的 ADR 模板](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)。*

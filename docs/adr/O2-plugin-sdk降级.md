# ADR-O2：Plugin SDK 降级为兼容层

- **状态**：Proposed
- **日期**：2026-07-01
- **来源**：[AI 生态冲击调整方案](../AI生态冲击调整方案.md) §4

---

## 背景

MCP 已成事实标准，Claude Skills Directory 上线后 Marketplace 货币化逻辑不成立。自建 Plugin SDK 生态规模无法与 AI 平台竞争。

## 决策

Plugin SDK 不发布 v1.0，仅维持 `0.1.0-alpha` 作为教学与浏览器内嵌入用途。

### 定位对比

| 维度 | 原定位 | 新定位 |
|------|--------|--------|
| 战略角色 | 生态核心，第三方扩展 Lokvis | **兼容层**，仅浏览器内嵌入 |
| 正式发布 | Phase 2 v1 | **Phase 3 或取消** |
| 优先级 | P0 | **P3**（Alpha 预览保留） |
| 替代方案 | — | MCP server 优先 |

### 对 PROJECT_PLAN W18 的调整

| 任务 | 原状态 | 新状态 |
|------|--------|--------|
| `@lokvis/plugin-sdk` npm 发布（alpha） | ✅ 维持 | 教学预览 |
| Plugin SDK 文档 | ✅ 维持 | 增加 MCP 对比章节 |
| 示例插件 `plugin-grayscale` | ✅ 维持 | 教学用 |
| 示例插件 `plugin-batch-watermark` | P1 | ⏭️ Phase 2（改为 MCP tool） |
| Plugin 脚手架 | P1 | ⏭️ Phase 2（优先 MCP server） |
| Plugin 权限沙箱 | P0 | ✅ 维持（安全必需） |

### 保留原因

1. **浏览器内嵌入**：用户用 `@lokvis/sdk` 嵌入到自己网站，需要自定义能力
2. **教学与示例**：帮助开发者理解 Lokvis 能力模型
3. **未来兼容**：若 MCP 生态变化，可作为 fallback

## 理由

1. 开发者更愿意做 MCP server（触达所有 AI 平台）
2. Plugin SDK 的浏览器内嵌入场景需求有限
3. 维护两套扩展机制成本高

## 后果

- `packages/plugin-sdk` 不主动投入，但不删除
- `definePlugin` / `PluginContext` 维持现状，增加注释说明"推荐 MCP server"
- 文档明确 Plugin SDK 与 MCP Server 的关系

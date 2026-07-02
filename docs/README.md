# Lokvis Open 文档

> Lokvis — Local-first Browser Workspace。一切在浏览器中运行，不上传、不部署服务器、不妥协。

本目录包含 `lokvis-open` 开源仓库的全部文档，涵盖技术架构、API 参考、项目规划与商业背景。

---

## 快速导航

### 技术文档

| 文档 | 说明 |
|------|------|
| [架构设计](./architecture.md) | 五层架构、Worker 隔离、HistoryStack、AssetStore 三级降级 |
| [能力目录](./capabilities.md) | `<domain>.<action>` 命名规范，所有内置能力清单 |
| [工作流系统](./workflows.md) | Workflow JSON Schema、执行流程、Year 1 约束 |
| [SDK 与 CLI 参考](./sdk-reference.md) | `@lokvis/sdk` API、`@lokvis/cli` 命令参考 |
| [MCP 集成](./mcp-integration.md) | 将 Lokvis 能力暴露给 Claude / ChatGPT / Cursor |
| [插件开发](./plugins.md) | Plugin SDK 结构、PluginContext API、Plugin SDK vs MCP Server |

### 项目规划

| 文档 | 说明 |
|------|------|
| [项目计划](./PROJECT_PLAN.md) | Phase 1（2026.07–12）24 周小时级任务拆分 |
| [AI 生态冲击调整方案](./AI生态冲击调整方案.md) | MCP-first 战略转型、Plugin SDK 降级、ADR-O1/O2/O3 |
| [路线图](./roadmap.md) | 三年四阶段战略、里程碑与 Go/No-Go 决策点 |

### 商业与战略（白皮书）

| 文档 | 说明 |
|------|------|
| [白皮书总览](./business/README.md) | 8 篇商业文档导航 |
| [执行摘要](./business/00-执行摘要与项目概述.md) | 项目定位、架构概览、Open Core 模式 |
| [市场调研](./business/01-市场调研与数据量化.md) | WASM/PWA 成熟度、市场规模、SEO 策略 |
| [竞品分析](./business/02-竞品分析.md) | 20+ 竞品横跨 4 个品类 |
| [产品定位](./business/03-产品定位与差异化.md) | 用户画像、Year 1 边界、品牌策略 |
| [技术架构](./business/04-技术架构设计.md) | 完整五层架构技术规范（白皮书版） |
| [商业模式](./business/05-商业模式与收入预测.md) | 收入模型、定价策略、三年预测 |
| [风险评估](./business/06-风险评估与应对.md) | 20 个风险、5 个类别、4 个 R1 级 |

### 架构决策记录（ADR）

| 文档 | 说明 |
|------|------|
| [ADR 索引](./adr/README.md) | 所有架构决策记录索引 |
| [ADR-011](./adr/011-mcp-server.md) | 新增 `@lokvis/mcp-server` 包 |
| [ADR-012](./adr/012-商业资产迁出.md) | 商业化资产迁出至 lokvis-cloud |
| [ADR-O1](./adr/O1-mcp-server定位.md) | lokvis-open 作为 MCP 能力提供方 |
| [ADR-O2](./adr/O2-plugin-sdk降级.md) | Plugin SDK 降级为兼容层 |
| [ADR-O3](./adr/O3-engine-ai定位.md) | engine-ai 定位为 AI 辅助 workflow 设计 |

---

## 文档结构说明

```
lokvis-open/docs/
├── README.md                      ← 你在这里
├── architecture.md                # 技术架构（合并 Starlight 文档 + 白皮书）
├── capabilities.md                # 能力目录
├── workflows.md                   # 工作流系统
├── sdk-reference.md               # SDK + CLI 参考
├── mcp-integration.md             # MCP 集成
├── plugins.md                     # 插件开发
├── roadmap.md                     # 路线图（合并多源）
├── PROJECT_PLAN.md                # Phase 1 项目计划
├── AI生态冲击调整方案.md           # AI 生态调整方案
├── business/                      # 白皮书（8 篇）
│   ├── README.md
│   ├── 00-执行摘要与项目概述.md
│   ├── 01-市场调研与数据量化.md
│   ├── 02-竞品分析.md
│   ├── 03-产品定位与差异化.md
│   ├── 04-技术架构设计.md
│   ├── 05-商业模式与收入预测.md
│   └── 06-风险评估与应对.md
└── adr/                           # 架构决策记录
    ├── README.md
    ├── 011-mcp-server.md
    ├── 012-商业资产迁出.md
    ├── O1-mcp-server定位.md
    ├── O2-plugin-sdk降级.md
    └── O3-engine-ai定位.md
```

---

## 语言说明

- **技术文档**（architecture / capabilities / sdk-reference 等）：中英混合，技术术语保留英文
- **项目规划**（PROJECT_PLAN / AI 调整方案）：中文
- **白皮书**（business/）：中文
- **ADR**：中文

如需完整英文版本，请参阅 [apps/docs](../apps/docs/src/content/docs/) 中的 Starlight 文档站。

---

*文档整理日期：2026-07-02*

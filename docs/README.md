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
| [MCP 集成](./mcp-integration.md) | 将 Lokvis 能力暴露给 Claude / ChatGPT / Cursor（含接口设计决策） |
| [插件开发](./plugins.md) | Plugin SDK 结构、PluginContext API、Plugin SDK vs MCP Server |

### 项目规划

| 文档 | 说明 |
|------|------|
| [**统一任务清单**](./TASKS.md) | **任务状态唯一信息源**：Phase 1 / 1.5 / 2 + 技术债务总览 |
| [项目计划](./PROJECT_PLAN.md) | Phase 1（2026.07–12）24 周小时级任务拆分（详细） |
| [AI 生态冲击调整方案](./AI生态冲击调整方案.md) | MCP-first 战略转型、Plugin SDK 降级、ADR-O1/O2/O3 |
| [路线图](./roadmap.md) | 三年四阶段战略、里程碑与 Go/No-Go 决策点 |
| [技术债务登记簿](./technical-debt.md) | 已知技术债务分类、长期方案、触发条件、Review 记录 |

### 诊断报告

| 文档 | 说明 |
|------|------|
| [W21.7 Lighthouse 基线](./reports/W21.7-lighthouse-baseline-2026-07-17.md) | 2026-07-17 首次实跑 Lighthouse 基线（Performance 62/100, LCP 6.9s） |
| [归档报告](./reports/archive/) | 已完成的里程碑验收、历史诊断快照与任务计划 |

### Blog & 叙事

| 文档 | 说明 |
|------|------|
| [MCP-first:让 AI 客户端就地处理本地文件](./blog/2026-07-15-mcp-first-local-tools.md) | Phase 2 M2.4 blog post — MCP-first 战略叙事 + 端到端验证结果 |

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

> **07 已归档**:原《路线图与里程碑》(v1.0) Phase 2/3 已过时,移至 [business/archive/](./business/archive/)。现行路线图见 [roadmap.md](./roadmap.md)。

### 架构决策记录（ADR）

| 文档 | 说明 |
|------|------|
| [ADR 索引](./adr/README.md) | 所有架构决策记录索引 |
| [ADR-011](./adr/011-mcp-server.md) | 新增 `@lokvis/mcp-server` 包 |
| [ADR-012](./adr/012-商业资产迁出.md) | 商业化资产迁出至 lokvis-cloud |
| [ADR-013](./adr/013-capability-manifest.md) | Capability Manifest 与 Codegen |
| [ADR-O1](./adr/O1-mcp-server定位.md) | lokvis-open 作为 MCP 能力提供方 |
| [ADR-O2](./adr/O2-plugin-sdk降级.md) | Plugin SDK 降级为兼容层 |
| [ADR-O3](./adr/O3-engine-ai定位.md) | engine-ai 定位为 AI 辅助 workflow 设计 |

---

## 文档结构说明

```
lokvis-open/docs/
├── README.md                      ← 你在这里
├── TASKS.md                       # 统一任务清单（状态唯一信息源）
├── architecture.md                # 技术架构（合并 Starlight 文档 + 白皮书）
├── capabilities.md                # 能力目录
├── workflows.md                   # 工作流系统
├── sdk-reference.md               # SDK + CLI 参考
├── mcp-integration.md             # MCP 集成（含接口设计决策，原 mcp-design-draft 已合并）
├── plugins.md                     # 插件开发
├── roadmap.md                     # 路线图（合并多源）
├── technical-debt.md              # 技术债务登记簿
├── PROJECT_PLAN.md                # Phase 1 项目计划（24 周小时级拆分,Phase 1 完成后归档）
├── AI生态冲击调整方案.md           # AI 生态调整方案（含 ADR-O1/O2/O3,已 Accepted）
├── business/                      # 白皮书（7 篇 + archive）
│   ├── README.md
│   ├── 00-执行摘要与项目概述.md
│   ├── 01-市场调研与数据量化.md
│   ├── 02-竞品分析.md
│   ├── 03-产品定位与差异化.md
│   ├── 04-技术架构设计.md
│   ├── 05-商业模式与收入预测.md
│   ├── 06-风险评估与应对.md
│   └── archive/                   # 已归档的白皮书
│       └── 07-路线图与里程碑.md   # v1.0 原始规划,Phase 2/3 已被 roadmap.md 取代
├── blog/                          # Blog & 叙事
│   └── 2026-07-15-mcp-first-local-tools.md  # Phase 2 M2.4
├── adr/                           # 架构决策记录
│   ├── README.md
│   ├── 011-mcp-server.md
│   ├── 012-商业资产迁出.md
│   ├── 013-capability-manifest.md
│   ├── O1-mcp-server定位.md
│   ├── O2-plugin-sdk降级.md
│   └── O3-engine-ai定位.md
└── reports/                       # 诊断报告与里程碑验收
    ├── W21.7-lighthouse-baseline-2026-07-17.md  # 现行 LCP 基线
    ├── lighthouse-2026-07-17.html                # 原始报告
    ├── lighthouse-2026-07-17.json                # 原始数据
    └── archive/                                  # 已归档的历史快照(14 份)
```

### archive 说明

`reports/archive/` 与 `business/archive/` 保留已过时但有历史档案价值的文档:

- **reports/archive/**(14 份):已完成的里程碑验收(W12/W16/W18 系列)、历史诊断快照(architecture-gap-analysis / architecture-deep-diagnostic)、已完成的任务计划(20260712 / 20260715)
- **business/archive/**(1 份):07-路线图与里程碑 v1.0,Phase 2/3 已被 roadmap.md 取代

---

## 语言说明

- **技术文档**（architecture / capabilities / sdk-reference 等）：中英混合，技术术语保留英文
- **项目规划**（PROJECT_PLAN / AI 调整方案）：中文
- **白皮书**（business/）：中文
- **ADR**：中文

如需完整英文版本，请参阅 [apps/docs](../apps/docs/src/content/docs/) 中的 Starlight 文档站。

---

*文档整理日期：2026-07-17*

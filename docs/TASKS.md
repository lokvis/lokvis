# Lokvis Open · 统一任务清单

> **本文档是 lokvis-open 项目任务状态的唯一信息源**，整合 Phase 1（PROJECT_PLAN）、Phase 1.5（架构优化）、Phase 2（MCP/Engine/Workflow）及技术债务。
>
> 详细任务拆分见交叉引用文档，本文档聚焦**状态追踪与下一步行动**。
>
> 最后更新：2026-07-15

---

## 状态总览

| 阶段 | 总任务数 | ✅ 完成 | ⬜ 待办 | ⛔ 废弃 | ⏭️ 延后 | 完成率 |
|------|---------|---------|---------|---------|---------|--------|
| **Phase 1** (W1-W24) | ~90 | ~71 | ~12 | 4 | 3 | 79% |
| **Phase 1.5** (架构优化) | 21 | 21 | 0 | 0 | 0 | 100% |
| **Phase 2** (MCP/Engine/Workflow) | 9 | 6 | 0 | 0 | 3 | 67% |
| **技术债务** | 16 | 9 | 7 | — | — | 56% |
| **合计** | ~136 | ~107 | ~12 | 4 | 6 | 79% |

---

## Phase 1 — MVP（2026.07-12）

> 详细周级拆分见 [PROJECT_PLAN.md](./PROJECT_PLAN.md)

### 里程碑状态

| 里程碑 | 目标日期 | 状态 | 说明 |
|--------|---------|------|------|
| M1.1 Alpha | 2026.09.30 | ✅ 已达成 | 2026-07-04 W12.1 Go 决策通过 |
| M1.2 Beta | 2026.10.31 | 🟡 代码侧就绪 | 待运维部署 + 真实用户反馈 |
| M1.3 发布 | 2026.12.15 | ⬜ 待开始 | W21-W24 全部待启动 |
| M1.4 首个 $1K MRR | 2027.02.28 | ⬜ 待开始 | cloud 侧验证 |

### 按月进度

| 月 | 周次 | 主题 | 进度 |
|----|------|------|------|
| M1 | W1-W4 | 基础设施 + Runtime 加固（Worker 隔离、undo/redo、OPFS、SDK API 冻结） | ✅ 完成 |
| M2 | W5-W8 | Image 工具（7 工具 + 批量 + 水印 + 历史 + 预设库 20+） | ✅ 完成 |
| M3 | W9-W12 | Workspace UI + Workflow Layer（SPA + 拖拽编辑器 + 5 步编排 + Alpha） | ✅ 代码侧完成 |
| M4 | W13-W16 | npm 发版 + Playground 5 demo + PWA | ✅ 完成 |
| M5 | W17-W20 | SDK 公开 + 文档 + Plugin SDK Alpha + CLI 最小版 | 🟡 仅 11/16 完成（19.1/19.5/19.7/19.9 + 18.3 + 20.1-20.6 完成） |
| M6 | W21-W24 | 性能优化 + 跨浏览器测试 + 开源发布 + Product Hunt | ⬜ 全部待开始 |

### M5/W17-W20 待办明细

| 任务 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 17.1-17.9 SDK 发布 + 类型导出 + auth 钩子 + isPro + examples | P0 | ⬜ | 全部待开始 |
| 17.11 ToolLayout vs AI 文案 | P0 | ⬜ | |
| 18.1-18.3 plugin-sdk npm + 文档 + 示例插件 | P1 | 🟡 | 18.3 完成(plugin-grayscale 教学插件 + 13 测试);18.1/18.2 待办 |
| 18.6 Plugin 权限沙箱 | P0 | ⬜ | |
| 19.2-19.6 文档结构 + API Ref + Guides + Architecture + 交互 Playground | P0 | 🟡 | 19.5 完成(四层协作综述+断链修复);19.1/19.7/19.9 此前完成;19.2/19.3/19.4/19.6/19.8 待办 |
| 20.1-20.6 CLI 最小版（run/capabilities/plugin create） | P1 | ✅ | 20.1-20.6 全部完成(run 默认注入 sharp 引擎 + --input/--output + 真实 resize 集成测试 + README + 帮助文本 + cli-automation 升级 + GitHub Actions 示例) |

### M6/W21-W24 待办明细

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 21.1-21.8 LCP<2.5s + WASM<5s + Bundle 分析 + 大文件 streaming + 内存泄漏 + Lighthouse | P0 | ⬜ |
| 22.1-22.6 Sentry Top20 修复 + 跨浏览器测试 + Safari 降级 + Playwright E2E | P0 | ⬜ |
| 23.1-23.9 README 终版 + CONTRIBUTING + Issue/PR 模板 + 文档站公开 + GitHub Releases | P0 | ⬜ |
| 24.1-24.7 Product Hunt + HN + Reddit + 发布日监控 + Phase 1 复盘 | P0 | ⬜ |

### 废弃任务（ADR-012 商业资产迁出）

| 任务 | 原优先级 | 废弃原因 |
|------|---------|---------|
| 1.2 apps/web 部署 Cloudflare Pages | P0 | apps/web 已迁至 cloud |
| 1.3 apps/web COOP/COEP 安全头 | P0 | 同上 |
| 17.10 首页"AI 做不到的 6 件事" | P0 | 已迁至 cloud apps/web |
| 19.10 `/mcp` 落地页 | P1 | 已迁至 cloud apps/web |

### 延后任务

| 任务 | 原优先级 | 延后至 | 原因 |
|------|---------|--------|------|
| 18.4 plugin-batch-watermark | P1 | Phase 2 | 改为 MCP tool 实现 |
| 18.5 Plugin 脚手架 | P1 | Phase 2 | 优先 MCP server |
| 20.7 plugin-dev Developer Workspace | P3 | Phase 4 | 白皮书 07 §5 明确 |

---

## Phase 1.5 — 架构优化（2026-07-13 完成）

> 详细任务拆分见 [reports/20260712-task-plan.md](./reports/20260712-task-plan.md)
>
> 触发：[architecture-deep-diagnostic-20260712.md](./reports/architecture-deep-diagnostic-20260712.md)

### W1-W2：Runtime 二次分层 + 单测

| 任务 | 状态 | 产出 |
|------|------|------|
| W1.1 抽取 quota-manager.ts | ✅ | 140 行，runtime.ts 拆分启动 |
| W1.F1 修复 4 处静默吞错 | ✅ | TD-3.1/3.2/3.3 清偿 |
| W1.2 抽取 asset-manager.ts | ✅ | 190 行 |
| W1.3 抽取 history-manager.ts | ✅ | 300 行，runtime.ts -271 行 |
| W1.4 抽取 workflow-coordinator.ts | ✅ | 157 行 |
| W1.5 抽取 mcp-manifest-builder.ts | ✅ | 108 行 |
| W1.6 抽取 plugin-context.ts | ✅ | 78 行 |
| W1.7 runtime.ts 改为 Facade | ✅ | 22 行（纯 re-export）+ runtime-impl.ts 199 行 |
| W1.8 验证 typecheck + test + coverage | ✅ | 792 测试全绿，runtime 覆盖率 90.62% |
| W2.1 提取 test-utils/fakes.ts | ✅ | OPFS fake 去重 |
| W2.2 5 个 managers 独立单测 | ✅ | 96 新测试，managers 覆盖率 99.07% |

### W3-W5：Plugin 补建 + Capability Manifest

| 任务 | 状态 | 产出 |
|------|------|------|
| W3.1 新建 plugin-audio | ✅ | 4 能力声明 + 桥接 engine-audio |
| W3.2 新建 plugin-ai | ✅ | 5 能力声明 + 桥接 engine-ai |
| W3.3 修复 engine-image AssetType 类型泄漏 | ✅ | |
| W4.1 设计 manifest schema + ADR-013 | ✅ | JSON Schema Draft 07 |
| W4.2 编写 codegen 脚本 | ✅ | 327 行，32 个能力自动生成 |
| W4.3 迁移 5 个 plugin 到 manifest | ✅ | 手写 presets 全部替换为 generated |
| W4.4 拆分 batch-processor.ts（738 行） | ✅ | 4 文件（246/207/226/52 行） |

### W6：ADR 正式化 + 白皮书修订 + 单测补齐

| 任务 | 状态 | 产出 |
|------|------|------|
| W6.1 ADR-O1/O2/O3 状态 Proposed → Accepted | ✅ | 3 个 ADR 补充 review 章节 |
| W6.2 白皮书 05 章重写 | ✅ | 删除 Marketplace 抽成，改为免费社区分享 |
| W6.3 cli / plugin-sdk 单测补齐 | ✅ | 58 + 33 测试，覆盖率 100% / 98.25% |

---

## Phase 2 — MCP / Engine / Workflow（2027.01-06）

> 详细任务拆分见 [reports/20260712-task-plan.md](./reports/20260712-task-plan.md) Phase 2 章节

### 轨道 A：MCP 主线

| 任务 | 状态 | 产出 |
|------|------|------|
| M2.1 stdio 传输 + NodeAssetStore | ✅ | 72 测试，覆盖率 88.99% |
| M2.2 engine-image-node + sharp | ✅ | 45 新测试，Node 端真实图片处理 |
| M2.3 SSE + BrowserBridge + ToolRouter | ✅ | 22 新测试，端到端验证通过 |
| **M2.4 Claude Desktop / Cursor 端到端验证** | ✅ **完成** | 可复现 e2e 脚本 + Cursor 示例 + blog post |

### 轨道 B：Engine 实装

| 任务 | 状态 | 阻塞原因 |
|------|------|---------|
| B1 engine-pdf 接 pdf-lib / mupdf wasm | ⛔ 待启动 | 7 操作实装 |
| B2 engine-video 接 ffmpeg-wasm | ⛔ 待启动 | 7 操作 + 30MB bundle 优化 |
| B3 engine-audio 接 audioworklet / ffmpeg | ⛔ 待启动 | 依赖 B2 基础设施 |

### 轨道 C：Workflow 层独立

| 任务 | 状态 | 产出 |
|------|------|------|
| C1 抽 `@lokvis/workflow` 独立包 | ✅ | `packages/workflow/` 新建；WorkflowBuilder + buildLinearWorkflow 迁入；MAX_WORKFLOW_STEPS 统一到 @lokvis/schema |
| C2 迁移 WorkflowBuilder + buildLinearWorkflow | ✅ | runtime workflow-builder.ts 改为 re-export shim；ui-react workflow-slice.ts 改用 @lokvis/workflow；workflow-coordinator.ts 修正 import 来源 |

---

## 技术债务

> 详细登记见 [technical-debt.md](./technical-debt.md)

### 债务总览

| 类别 | 数量 | 严重度 | 已清偿 | 剩余 |
|------|------|--------|--------|------|
| Phase 2 路线（功能性取舍） | 2 | 中 | 0 | 2 |
| 测试时序依赖 | 2 | 中 | 0 | 2 |
| 静默吞错 | 4 | 低 | 3 | 1 |
| 类型层面 workaround | 4 | 低 | 0 | 4 |
| UI ObjectURL 生命周期 | 2 | 中 | 0 | 2 |
| 事件订阅 cleanup | 3 | 低 | 0 | 3 |
| 测试环境 hack（非债务） | 3 | — | — | 3 |

**净评估：无阻塞性债务。** 剩余均为"有防护的局部 workaround"或"Phase 2 路线性取舍"。

### Phase 2 候选清偿项

| 债务 ID | 描述 | 触发条件 |
|---------|------|---------|
| TD-1.1 | MCP Node 降级模式文件读写 | Phase 2 MCP Server v1 开发 |
| TD-1.2 | 批量队列持久化 | Phase 2 或用户反馈 |
| TD-3.4 | exif-reader 静默返回 null | 接入可观测系统时 |
| TD-4.3 | CLI 手写 type guard → zod | Phase 4 CLI 正式发布前 |
| TD-5.1 | ObjectURL 生命周期重构 | 重构 assets-slice 时 |

---

## 推荐执行顺序

### 立即可推进

1. **Phase 1 W17-W20** — SDK 公开 + 文档完善 + CLI 最小版（M5 主线）
2. **B1 + B2 并行** — PDF 与 Video 引擎实装，解锁 Phase 2 Workspace

### 中期推进

3. **Phase 1 W21-W24** — 性能优化 + 开源发布 + Product Hunt
4. **B3** — Audio 引擎（依赖 B2 ffmpeg 基础设施）

### 已完成（最近）

- ✅ **W18.3**（2026-07-15）— 示例插件 `plugin-grayscale`(教学用):`examples/plugin-grayscale/`,`grayscalePlugin()` 注册 `image.grayscale` 能力,自包含 canvas 灰度化 operation(decode→逐像素→encode),3 种算法(luminance/average/lightness);13 测试覆盖插件常量/installer 注册数/factory 返回数/stub status/execute 抛错/三种算法 + abort;README 含 30 秒速览 + 算法表 + 与官方 plugin-image 对比表。
- ✅ **W19.5**（2026-07-15）— Architecture 深度文补强:修复 `architecture.mdx` 断链(`docs/whitepaper/` → `docs/business/`,中英两版);新增"四层协作"综述章节,串联 Runtime/Capability/Plugin/Engine 请求流 + 单向依赖 + 四篇深度文档链接(中英两版)。四层深度文(runtime/engine/capability/plugin)此前已存在且完整。
- ✅ **W20.6**（2026-07-15）— `examples/cli-automation` 升级:`automate.ts` 移除过时 Node 限制说明,真实跑 image.resize(1920x1080→1280x720 PNG 174ms);新增 `.github/workflows/resize-ci.yml` GitHub Actions CI gate 示例;README 重写。W20 CLI 最小版全部完成。
- ✅ **W20.5**（2026-07-15）— CLI README 新建(`packages/cli/README.md`):命令清单 + 用法示例 + Node 端 5 真实图像能力表 + 编程式 API + 限制说明;`version.ts` 同步到 0.2.2(原硬编码 0.1.0 与 package.json 不同步);help 文本 W20.1 已更新覆盖 --input/--output。
- ✅ **W20.4**（2026-07-15）— CLI 集成测试 `packages/cli/src/__tests__/integration/run-resize.integration.test.ts`,3 测试覆盖 resize(200x100→100x50 PNG) + compress(PNG→JPEG) + 无 --output 路径,真实 sharp 引擎端到端跑通,作为持续验证 CLI 端到端可用性的护栏。
- ✅ **W20.1/20.2/20.3**（2026-07-15）— CLI `run` 命令默认注入 `imageToolsPluginNode`(sharp 引擎),支持 `--input`/`--output` 选项;Node 端真实跑图像工作流端到端验证通过(256x192→64x48 PNG 37ms)。`capabilities` 与 `plugin create` 命令核验通过。
- ✅ **M2.4**（2026-07-15）— Claude Desktop / Cursor 端到端验证 + 可复现 demo + blog post（详见 [blog](./blog/2026-07-15-mcp-first-local-tools.md)）

---

## 交叉引用

| 文档 | 说明 |
|------|------|
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | Phase 1 W1-W24 小时级任务拆分（详细） |
| [reports/20260712-task-plan.md](./reports/20260712-task-plan.md) | Phase 1.5 + Phase 2 任务拆分（详细） |
| [technical-debt.md](./technical-debt.md) | 技术债务登记簿（完整） |
| [roadmap.md](./roadmap.md) | 三年四阶段战略路线图 |
| [AI生态冲击调整方案.md](./AI生态冲击调整方案.md) | MCP-first 战略转型背景 |

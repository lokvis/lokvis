# 架构与实现综合诊断报告

- **日期**：2026-07-12
- **作者**：Qoder（基于 docs 精读 + 代码审计双 agent 综合）
- **范围**：`/docs`、`/packages`、`/apps`、`/AGENTS.md`
- **输入**：
  - `docs-analyst` agent（文档/战略/路线图/业务/ADR 全景）
  - `code-auditor` agent（五层架构实现层审计）
  - 关键文件人工复核（`runtime.ts` 行数、包目录对比）

---

## 1. 总体评分

| 维度 | 分数 | 一句话结论 |
|---|---|---|
| **架构健康度** | 8 / 10 | 分层纪律上乘，Engine 纯净、EventBus 安全、CapabilityRegistry stub 过滤全部合规 |
| **战略健康度** | 6 / 10 | 2026-07 AI 调整方案是根本转向，但白皮书、ADR 状态、Phase 2 工时、团队规模四者未同步 |
| **工程健康度** | 7 / 10 | 单向依赖严格遵守，但 `runtime.ts` 1151 行成为隐性 God Object，且 6 个包零测试 |

---

## 2. 五层架构实现层校验（来自 code-auditor）

| 层级 | 包 | 合规性 | 备注 |
|---|---|---|---|
| Engine | engine-{core,image,pdf,video,audio,ai} | ✅ | 统一 `(Blob, Record<string,any>, signal?) => Promise<Blob>` |
| Capability | capability, plugin-{image,pdf,video,dev,sdk} | ⚠️ | engine-audio / engine-ai 无对应 plugin |
| Runtime | runtime | ⚠️ | runtime.ts 1151 行（God Object） |
| Workflow | （分散） | ⚠️ | AGENTS.md 声明独立层，但实际分散在 ui-react/runtime |
| UI | ui-core, ui-react | ✅ | ToolRunner engine 经 prop 注入，零跨层 import |

**层间依赖真实性**：grep `from '@lokvis/(runtime|capability|plugin-|ui-)'` 在所有 engine-* 包 → **零匹配**；在 plugin-* 中搜 runtime/ui → **零匹配**；在 runtime 中搜 engine/plugin/ui → **零匹配**。

**`as unknown as` 双断言**：生产代码仅 1 处（`engine-image/src/worker-adapter.ts:242` Worker scope 跨边界，AGENTS.md 明确允许的例外）。

---

## 3. 核心问题分级

### P0 — 阻塞 Phase 2 战略验证

| # | 问题 | 依据 |
|---|---|---|
| 1 | **MCP Server 仅骨架** — `createServer()` 返回 `{ server: null }`，stdio/SSE/WebSocket 三传输均未实现 | `mcp-server/src/server.ts:154`、ADR-011、gap 报告 |
| 2 | **4/5 Engine 为 stub** — video/pdf/audio/ai 全部抛"not implemented" | `plugin-{video,pdf}/src/operations.ts`、Phase 2 关键路径 |
| 3 | **ADR-O1/O2/O3 仍 Proposed** — 战略已被 roadmap/代码消费，ADR 未正式化 | `docs/adr/O*.md` vs PROJECT_PLAN |
| 4 | **白皮书与 AI 调整方案根本矛盾** — 白皮书仍以 Marketplace 抽成 35% 为收入核心，调整方案已改"免费社区分享" | `business/05-*.md` vs `AI生态冲击调整方案.md` |

### P1 — 影响可扩展性与长期维护

| # | 问题 | 依据 |
|---|---|---|
| 5 | **`runtime.ts` 1151 行 God Object** — `LokvisRuntimeImpl` 承载 8 类职责 | `packages/runtime/src/runtime.ts:195-990` |
| 6 | **engine-audio / engine-ai 无对应 plugin** — Capability 层桥梁缺失 | `packages/` 目录对比 |
| 7 | **能力硬编码** — 新增 engine 需改 schema 联合类型 / capability presets / plugin operations 三处 | `plugin-image/src/operations.ts:58-68` |
| 8 | **Workflow 层未独立** — `buildLinearWorkflow` 嵌在 `ui-react/store/workflow-slice.ts:327` | ui-react 与 runtime 双落点 |
| 9 | **6 个包零测试** — engine-{core,pdf,video,audio,ai}、plugin-{pdf,video,dev,sdk}、cli、ui-core | vitest coverage |
| 10 | **双轨文档** — `docs/` 与 `apps/docs/` 内容分歧 | gap 报告 P2-6 |

### P2 — 中期优化

| # | 问题 |
|---|---|
| 11 | `batch-processor.ts` 738 行、`worker-host.ts` 583 行、`platform.ts` 817 行数据文件 |
| 12 | OPFS FakeDirHandle/FakeFileHandle 在两个测试文件重复实现 |
| 13 | `engine-image/types.ts` 再导出 `AssetType` 形成类型泄漏 |
| 14 | technical-debt.md 中 TD-1.2 批量队列状态不持久化、TD-3.x 静默吞错 `.catch(()=>{})` 4 处 |

---

## 4. 架构设计层面的真问题

1. **"五层" vs 实际"四层半"**：Workflow 没有独立包。Phase 2 启动前需选择：抽 `@lokvis/workflow`，或在 AGENTS.md 降级为"四段式"。
2. **Capability 的"静态注册"与"动态发现"矛盾**：每个 plugin 手写 `IMAGE_CAPABILITY_ENTRIES` 数组，长期方向应是声明式 manifest + 代码生成，否则 Phase 3 Marketplace 不可行。
3. **Runtime 职责过载是架构信号**：8 类职责说明 Runtime 需要二次分层（Facade / WorkflowCoordinator / AssetManager / HistoryManager / MCPManifestBuilder / QuotaManager）。
4. **Plugin SDK 战略降级后缺少收尾**：ADR-O2 说降级为 Alpha 兼容层，但 plugin-sdk 仍是 plugin-* 的硬依赖，定位模糊。
5. **MCP 是 Phase 2 唯一入口，但无 Plan B**：96h 工时 + sharp Node adapter + 4 stub engine 全压在 Phase 2 的 6 个月窗口。

---

## 5. 开发计划建议

### Phase 1.5（建议新增，4-6 周，Beta 前）— "打地基 + 清债"

| 周 | 主线 | 副线 | 验收 |
|---|---|---|---|
| W1 | Runtime 拆分（Facade + 5 managers） | 修 4 处静默吞错 | PR 合并，20 个 runtime 测试全绿 |
| W2 | Runtime 拆分单测补全 | OPFS fake 提取到 `test-utils/fakes.ts` | runtime.ts 降至 ≤250 行 |
| W3 | 新建 plugin-audio / plugin-ai（接 stub engine） | engine-image types 类型泄漏修复 | 5 个域全部有 plugin 桥 |
| W4 | Capability Manifest 设计 + codegen | `batch-processor.ts` 拆分 | image manifest 迁移完成 |
| W5 | 迁移 plugin-pdf / plugin-video 到 manifest | engine-core 单测 ≥60% | 全量迁移，旧数组 API 删除 |
| W6 | ADR O1/O2/O3 正式化 + 白皮书修订 | cli / plugin-sdk 单测补齐 | ADR 状态与战略一致 |

### Phase 2（2027.01-06）— AI 调整方案执行，三轨并行

**轨道 A：MCP 主线（最高优先级）**
- M2.1：MCP Server stdio 传输 + 最小 tool 集（image.resize / image.compress / image.convert）
- M2.2：Node Engine Adapter（sharp 替代 browser canvas）— MCP 能跑起来的硬前提
- M2.3：SSE 传输 + BrowserBridge
- M2.4：真实接入 Claude Desktop / Cursor 做端到端验证

**轨道 B：Engine 实装**
- M2.1：engine-pdf 接 pdf-lib / mupdf wasm
- M2.3：engine-video 接 ffmpeg-wasm
- M2.5：engine-audio 接 audioworklet / ffmpeg

**轨道 C（后台）：Workflow 层独立**
- 抽 `@lokvis/workflow` 包，迁移 `WorkflowBuilder` 与 `buildLinearWorkflow`
- 为 Phase 3 Marketplace 的 Schema 可移植性做准备

### Phase 3 之前不建议做的事

- ❌ Marketplace 抽成 / 付费墙实现（与 AI 调整方案矛盾，需先修订白皮书）
- ❌ 桌面版 Tauri（Phase 4 目标，但 Phase 2 关键路径还没通）
- ❌ Plugin SDK v1 正式发布（ADR-O2 已降级）

---

## 6. Runtime 二次分层详细设计（P1-5，推荐第一项动手）

### 现状（runtime.ts 1151 行，8 类职责）

```
LokvisRuntimeImpl (195-990)
 ├─ workflow:    run/cancel/pause/resume/disposeWorkflow (345-460)
 ├─ history:     history/getHistoryState/undo/redo/jumpTo (470-520)
 ├─ asset:       import/get/export/readExif/remove/list (523-628)
 ├─ storage:     getStorageUsage (630)
 ├─ capability:  capabilities/hasCapability/isStubOnly (649-670)
 ├─ mcp:         toMcpManifest (672-728)
 ├─ plugin:      installPlugin (730)
 ├─ metadata:    _registerMetadataReader (263)
 └─ quota:       wrapAssetStoreWithQuota (110-190) + QuotaExceededError (69)
```

### 目标拓扑（保持 `LokvisRuntime` 接口不变）

```
packages/runtime/src/
 ├─ runtime.ts                    ← Facade, 仅委托
 ├─ managers/
 │   ├─ asset-manager.ts          ← import/get/export/remove/list/exif
 │   ├─ history-manager.ts        ← undo/redo/jumpTo/snapshot/persist
 │   ├─ quota-manager.ts          ← wrapAssetStoreWithQuota + 错误类
 │   ├─ workflow-coordinator.ts   ← run/cancel/pause/resume/dispose
 │   └─ mcp-manifest-builder.ts   ← toMcpManifest + JSON Schema 转换
 ├─ create-runtime.ts             ← createRuntime 工厂
 ├─ plugin-context.ts             ← createPluginContext
 ├─ runtime-impl.ts               ← 薄壳，持有 managers 并转发
 └─ __tests__/                    ← 每个 manager 独立单测
```

### 收益
- 单文件 ≤ 300 行，认知负载降一个数量级
- Managers 可独立 mock / 独立单测
- MCP Phase 2 接入时只改 `mcp-manifest-builder.ts`
- 未来若引入 `RemoteRuntime`，Facade 模式天然支持

### 风险
- 现有 20 个 runtime 测试文件 import 路径变化 → 保留 `runtime.ts` 作为 re-export 入口；1 个 commit 完成

---

## 7. Capability Manifest 设计（P1-7，长期 ROI 最高）

### 现状痛点
新增 `image.heic_convert` 需改 3 处：schema 联合类型 / capability presets / plugin operations。

### 目标：Single Source of Truth

`packages/capability/manifests/image.manifest.json`：
```json
{
  "domain": "image",
  "capabilities": [
    {
      "action": "heic_convert",
      "description": "Convert HEIC/HEIF to JPEG/PNG",
      "params": [
        { "name": "format", "type": "enum", "values": ["jpeg", "png"] },
        { "name": "quality", "type": "number", "min": 1, "max": 100, "default": 85 }
      ],
      "inputTypes": ["image/heic", "image/heif"],
      "outputType": "passthrough"
    }
  ]
}
```

`pnpm codegen` 自动生成 schema 联合类型与 presets；plugin 通过 `registerFromManifest(manifest, implMap)` 一行注册。

### 收益
- Phase 3 Marketplace 的前提（manifest 是天然序列化载体）
- MCP Server 直出（`toMcpManifest()` 可直接聚合）
- 第三方可参与（只需写 manifest + impl）

---

## 8. MCP Server Phase 2 实施路线（P0-1）

### M2.1 — stdio 传输 + Node AssetStore
- 实现 `NodeAssetStore`（基于 `fs/promises` + `workdir`）
- 接入 `@modelcontextprotocol/sdk` 的 stdio transport
- 暴露 3 个 tool：`image.resize` / `image.compress` / `image.convert`
- **验收**：Claude Desktop 通过 stdio 调用 → 真实图片处理 → 返回结果

### M2.2 — Node Engine Adapter（sharp 替代 canvas）
- 新建 `engine-image-node` 包，依赖 `sharp`
- `plugin-image` 在 Node 环境自动选择 node engine
- **架构约束**：`engine-image-node` 仍是 Engine 层，必须 Blob↔Blob

### M2.3 — SSE 传输 + BrowserBridge
- SSE transport（适合 Web 客户端）
- BrowserBridge：让浏览器内运行的 lokvis-open 暴露能力给本地 MCP Server
- ToolRouter：按能力类型路由到 browser 或 node

### M2.4 — 端到端验证
- 接入 Claude Desktop / Cursor 各做 1 个 demo workflow
- 收集反馈，迭代 tool schema

### 关键决策点
- Node Engine Adapter 建议独立成 `engine-image-node`，保持 engine-image 浏览器纯净性
- BrowserBridge 走 WebSocket（Phase 2），Phase 4 Tauri 再切 postMessage

---

## 9. Beta 发布门禁

- [ ] runtime.ts 拆完（单文件 ≤250 行）
- [ ] 5 个域都有 plugin 桥
- [ ] manifest codegen 跑通
- [ ] 核心包覆盖率 ≥60%
- [ ] ADR 状态与战略一致
- [ ] 白皮书 05 章修订完成

---

## 10. 与既有文档的关系

| 既有文档 | 本报告立场 |
|---|---|
| `architecture-gap-analysis-20260710.md` | 互补——gap 报告聚焦发布阻塞项，本报告聚焦架构演进与战略脱节 |
| `AI生态冲击调整方案.md` | 赞同方向，但指出白皮书未同步修订的风险 |
| `technical-debt.md` | 本报告 §3.P2 的 4 项问题均源自 technical-debt.md，建议 Phase 1.5 批量清理 |
| `PROJECT_PLAN.md` | 建议新增"Phase 2 关键路径风险"章节，明确 MCP Server 为唯一阻塞项 |

---

## 11. 一句话结论

> **架构层面没有"坏味道"，问题集中在 `runtime.ts` 过载与 capability 注册方式两处；战略层面的脱节（白皮书 vs AI 调整方案 vs ADR 状态）才是更大的风险，建议在 Beta 发布前优先闭合。**

# lokvis-open 架构分析与 Gap 报告

> 日期: 2026-07-10  
> 范围: `lokvis-open` 全部 19 个 packages + 35 篇文档  
> 基线: `dev` branch commit `19700a4`

---

## 目录

1. [架构健康度评估](#1-架构健康度评估)
2. [架构层面的问题](#2-架构层面的问题)
3. [规划 vs 实际 Gap 矩阵](#3-规划-vs-实际-gap-矩阵)
4. [代码 Review 发现](#4-代码-review-发现)
5. [后续执行计划](#5-后续执行计划)
6. [风险与依赖](#6-风险与依赖)

---

## 1. 架构健康度评估

### 1.1 总览

**整体评估：良好** — 五层架构（UI → Workflow → Runtime → Capability → Engine）依赖方向严格遵守，零层级违规。

| 维度 | 状态 | 说明 |
|------|------|------|
| 层级依赖 | ✅ 干净 | 无 UI→Engine、Workflow→Engine 等反向引用 |
| Stub 约定 | ✅ 一致 | `version` 含 `'stub'`，`CapabilityRegistry.resolve()` 自动跳过 |
| AGENTS.md 合规 | ✅ | 仅 1 处允许的 `as unknown as`，无禁用模式 |
| 测试覆盖 | ⚠️ | 787 tests / 91.62% line coverage，但 9 个包零测试文件 |
| 设计 Token | ✅ | `--lokvis-*` CSS 变量体系完整，light/dark 双模式 |

### 1.2 五层依赖图

```
UI (ui-core, ui-react)
  ↓
Workflow (workspace store, pipeline)
  ↓
Runtime (capability registry, plugin loader)
  ↓
Capability (schema, capability definitions)
  ↓
Engine (engine-image, engine-video, ...)
```

所有跨层引用均为**上→下**方向，未发现反向依赖。ToolRunner 通过 `engine` prop 注入实现依赖反转，避免 UI→Engine 直接引用。

### 1.3 包统计

| 分类 | 包数 | 有测试 | 有 README |
|------|------|--------|-----------|
| UI 层 | 2 | 2 | 2 |
| Workflow 层 | 1 | 1 | 0 |
| Runtime 层 | 2 | 2 | 1 |
| Capability 层 | 3 | 3 | 1 |
| Engine 层 | 5 | 5 | 1 |
| 工具/配置 | 4 | 2 | 0 |
| MCP Server | 1 | 0 | 0 |
| Playground | 1 | 0 | 0 |
| **合计** | **19** | **15** | **5** |

---

## 2. 架构层面的问题

### 2.1 ToolRunner ↔ Workspace 状态割裂

**严重程度: 中**

ToolRunner 独立管理 `inputBlob`/`outputBlob`/`params` 状态，与 Workspace 的 Zustand store 无共享机制。当前 `onOpenInWorkspace` 仅定义了回调签名：

```typescript
onOpenInWorkspace?: (state: {
  inputBlob: Blob;
  outputBlob: Blob | null;
  params: Record<string, unknown>;
}) => void;
```

**问题**: 没有实际的 bridge 实现。用户从 ToolRunner "Open in Workspace" 时需要将状态注入到 Workspace store，但 Workspace 的 `initialAssets` / `initialCapability` / `initialParams` props 仅支持初始化时消费，运行时无二次注入能力。

**建议**: 在 Workspace 组件增加 `useImperativeHandle` 或 ref-based API，允许外部在运行时注入新的 asset + capability 状态。

### 2.2 Engine 层 4/5 域仍为 Stub

**严重程度: 高**

| Engine 域 | 状态 | 已注册 Capabilities |
|-----------|------|---------------------|
| `engine-image` | ✅ 真实实现 | compress, resize, convert, crop, rotate, flip, watermark, filter, background |
| `engine-video` | ⚠️ Stub | transcode, trim, extract-frames, subtitle |
| `engine-audio` | ⚠️ Stub | transcode, noise-reduce, split, merge |
| `engine-document` | ⚠️ Stub | convert, merge, split, watermark, ocr |
| `engine-3d` | ⚠️ Stub | convert, optimize |

Runtime 层的 capability 注册完整，但实际可执行的 pipeline 仅限图片处理。这意味着：
- 非图片类 workflow 在用户选择 capability 后会在执行阶段抛出 stub error
- UI 层没有对 stub capability 的可见区分（无 "coming soon" 标记）

**建议**: 在 `CapabilityRegistry` 中标记 stub 状态，UI 层读取并显示 "Alpha/Beta" 标签或禁用非图片类节点添加。

### 2.3 MCP Server 仅骨架

**严重程度: 高（Phase 2 阻塞）**

ADR-011 定义了 Mode E hybrid 架构（stdio + SSE + WebSocket），但当前实现：

```typescript
// packages/mcp-server/src/index.ts
export function createServer(): { server: null } {
  return { server: null };
}
```

- stdio transport: ❌ 未实现
- SSE transport: ❌ 未实现
- WebSocket 7890: ❌ 未实现
- Tool listing bridge → `runTool()`: ❌ 未实现

MCP Server 是 AI 集成（Claude Desktop、Cursor 等）的核心入口，其缺失意味着整个 Phase 2 的 AI 生态接入无法启动。

### 2.4 Zustand Store 无持久化边界

**严重程度: 低**

Workspace store 的 5 个 slice（runtime, assets, capabilities, workflow, history）全部为内存态。刷新页面后所有状态丢失。虽然当前定位为 "session-based workspace"，但 PROJECT_PLAN 提到的 workflow save/load 功能需要至少部分状态持久化（如 nodes 列表 + params）。

---

## 3. 规划 vs 实际 Gap 矩阵

### 3.1 P0 — 阻塞发布

| ID | Gap | 规划目标 | 实际状态 | 影响范围 |
|----|-----|----------|----------|----------|
| P0-1 | Playground 部署 | M1.2 Beta 可公开访问 | 4 项运维未完成（域名、Vercel 配置、CI pipeline、E2E smoke） | 无法演示、无法获取用户反馈 |
| P0-2 | NPM_TOKEN | CI/CD release 必需 | 未配置 GitHub secret | 所有包无法发布到 npm registry |
| P0-3 | W17 SDK 打包 | 40h 计划 | 0h 开始 | SDK Alpha 里程碑延期 |
| P0-4 | Changeset 配置 | release 流程必需 | `@changesets/cli` 已安装但 `.changeset/config.json` 未验证 | release workflow 可能失败 |

### 3.2 P1 — 影响 Phase 2 启动

| ID | Gap | 规划目标 | 实际状态 | 影响范围 |
|----|-----|----------|----------|----------|
| P1-1 | W18 Plugin SDK Alpha | 40h | 0h | 第三方插件生态无法启动 |
| P1-2 | W19 文档结构 | 26h | 0h | 开发者文档缺失阻碍外部贡献 |
| P1-3 | W20 CLI 工具 | 40h | 0h | 命令行工具链空白 |
| P1-4 | MCP Server 实现 | ADR-011 Accepted | 仅 skeleton (`server: null`) | AI 集成能力完全缺失 |
| P1-5 | Stub capability UI 标记 | UX 必需 | 未实现 | 用户选非图片能力后困惑 |

### 3.3 P2 — 质量保障与技术债

| ID | Gap | 规划目标 | 实际状态 |
|----|-----|----------|----------|
| P2-1 | E2E 测试 | Playwright 覆盖核心流程 | 0 tests |
| P2-2 | 跨浏览器测试 | Chrome / Firefox / Safari | 0 |
| P2-3 | 性能基线 | Lighthouse ≥90, crash rate <0.1% | 无实际测量数据 |
| P2-4 | 9 个包零测试 | 100% 包覆盖 | schema, runtime, mcp-server, playground 等 |
| P2-5 | 17 个包缺 README | 100% 包覆盖 | 仅 ui-core 和 engine-image 有实质文档 |
| P2-6 | 双轨文档未同步 | 单一信息源 | `docs/` vs `apps/docs/` 内容分歧 |
| P2-7 | plugins.md 过时 | 与 ADR 一致 | 内容未反映 ADR-012 商业资产迁移 |

### 3.4 里程碑对照

| 里程碑 | 规划时间 | 规划内容 | 完成度 |
|--------|----------|----------|--------|
| M1.1 Alpha | W12-W14 | Core engine + UI | **~90%** — 代码完成，部分运维项 pending |
| M1.2 Beta | W15-W16 | Deploy + npm publish | **~60%** — 代码 ready，部署/publish 未完成 |
| M2.1 SDK Alpha | W17 | Public SDK + runTool | **~20%** — runTool 已实现，打包/publish 未做 |
| M2.2 Plugin SDK | W18 | Plugin manifest + loader | **0%** — 未开始 |
| M2.3 MCP | W19-W20 | MCP server + AI integration | **~5%** — 仅 package skeleton |
| M2.4 CLI | W20-W21 | CLI tool (lokvis-cli) | **0%** — 未开始 |

---

## 4. 代码 Review 发现

### 4.1 本轮改动引入的问题（theme & toolpage）

#### 4.1.1 Input/Textarea 组件消费断层

**严重程度: 低**

ui-core 新增了 `<Input>` 和 `<Textarea>` 组件，但 ui-react 内的表单组件（ParamForm、AssetPanel search、WorkflowEditor filter）仍使用原生 `<input>` + 手写 Tailwind class。样式一致性依赖手动同步而非组件化保证。

**影响文件:**
- `packages/ui-react/src/components/ParamForm.tsx` — `inputBase` 手写 class
- `packages/ui-react/src/components/AssetPanel.tsx` — search input
- `packages/ui-react/src/components/WorkflowEditor.tsx` — filter input
- `packages/ui-react/src/components/Inspector.tsx` — note textarea

**建议:** 迁移到 `<Input>` / `<Textarea>` 组件，消除重复样式定义。

#### 4.1.2 Elevation Token 覆盖不完整

**严重程度: 低**

以下组件已迁移到 `--lokvis-elevation-*`:
- Card, Dialog, Canvas, CompareSlider ✅

以下仍使用硬编码 shadow:
- Toolbar dropdown — `shadow-lg`
- CommandPalette overlay — `shadow-2xl`
- DownloadPanel — `shadow-xl`
- GlobalDropzone overlay — `shadow-lg`

#### 4.1.3 `control-h` sm/lg 变体无消费者

tokens.css 定义了三个高度变体：

```css
--lokvis-control-h-sm: 28px;
--lokvis-control-h: 32px;
--lokvis-control-h-lg: 40px;
```

但 Input 组件仅引用 `--lokvis-control-h`，sm/lg 变体未被任何组件使用。

#### 4.1.4 PipelineBar remove 按钮可访问性残留

虽然已将 `<span role="button">` 改为 `<button type="button">`，但该按钮内嵌在父 `<button>` (selectNode) 内部，形成 **button-in-button** 嵌套。虽然通过 `e.stopPropagation()` 阻止了事件冒泡，但在键盘导航时父 button 会整体获得焦点，子 button 不可独立 tab 到。

**建议:** 将 remove button 提取到父 button 外部，使用 flex layout 并排。

### 4.2 预存问题（非本轮引入）

#### 4.2.1 Store 类型定义耦合

`useWorkspaceStore` 的 `WorkspaceState` 和 `WorkspaceActions` 定义在同一文件中，随着 slice 增长（当前 5 个），单文件体积持续膨胀。建议按 slice 拆分类型定义文件。

#### 4.2.2 Engine 操作函数签名不统一

`runTool` 的 `TOOL_MAP` 中所有函数签名为 `(blob, params, signal?) => Promise<Blob>`，但部分操作（如 `crop`、`watermark`）在 params 中期望特定类型（`CropParams`、`WatermarkParams`），运行时类型安全依赖 `as Record<string, any>` 断言。

#### 4.2.3 缺少 Error Boundary

Workspace 组件树无 React Error Boundary。任何子组件的运行时异常会导致整个 workspace 白屏。

---

## 5. 后续执行计划

### Phase A — 发布就绪（W17，1 周）

**目标:** npm publish + playground 可公开访问

| # | 任务 | 包/文件 | 预估 | 前置依赖 |
|---|------|---------|------|----------|
| A1 | 配置 NPM_TOKEN GitHub secret | CI/CD | 0.5h | 无 |
| A2 | 验证 changeset config + dry-run publish | `.changeset/`, CI | 2h | A1 |
| A3 | Playground Vercel 部署 + 自定义域名 | `apps/playground/` | 4h | 无 |
| A4 | E2E smoke test（3 条核心路径） | `apps/playground/e2e/` | 8h | A3 |
| A5 | SDK 入口打包 + npm publish (engine-image) | `packages/engine-image` | 4h | A1, A2 |
| A6 | 9 个零测试包补充单元测试 | `schema`, `runtime`, `mcp-server` 等 | 12h | 无 |
| A7 | Stub capability UI 标记（"Coming Soon" badge） | `ui-react/WorkflowEditor` | 3h | 无 |

**Phase A 完成标准:**
- [ ] `@lokvis/engine-image` 可在 npm install
- [ ] Playground URL 可公开访问
- [ ] 3 条 E2E smoke test pass（upload → add node → run → download）

### Phase B — Plugin SDK Alpha（W18，2 周）

**目标:** 第三方可开发并注册自定义 capability 插件

| # | 任务 | 说明 | 预估 |
|---|------|------|------|
| B1 | Plugin manifest schema 设计 | 定义 `plugin.json` 格式: name, version, capabilities, entry, permissions | 8h |
| B2 | `createPlugin()` factory API | Runtime 层插件注册，返回 `PluginInstance` | 12h |
| B3 | Sandbox capability execution | Web Worker 隔离第三方引擎执行 | 16h |
| B4 | Plugin 开发文档 | 快速开始 + API reference + 示例 | 8h |
| B5 | 示例插件实现 | 实现一个完整的外部 capability 插件（如 image.round-corners） | 8h |

**Phase B 完成标准:**
- [ ] 示例插件可通过 `createPlugin()` 注册并在 Workspace 中执行
- [ ] Plugin 开发文档发布

### Phase C — MCP Server 实现（W19-W20，2 周）

**目标:** AI 工具（Claude Desktop / Cursor）可通过 MCP 协议调用 lokvis 能力

| # | 任务 | 对应 ADR | 预估 |
|---|------|----------|------|
| C1 | stdio transport + JSON-RPC 2.0 | ADR-011 §3.1 | 8h |
| C2 | SSE transport + HTTP endpoint | ADR-011 §3.2 | 8h |
| C3 | WebSocket 7890 端口 | ADR-011 §3.3 | 6h |
| C4 | Tool listing bridge | 连接 `runTool()` + `listTools()` | 4h |
| C5 | Tool execution bridge | Blob 序列化 + progress 回传 | 8h |
| C6 | MCP 集成测试 | stdio + SSE 双通道验证 | 6h |

**Phase C 完成标准:**
- [ ] Claude Desktop 可通过 MCP config 连接 lokvis server
- [ ] `tools/list` 返回所有已注册 capability
- [ ] `tools/call` 可执行 `image.compress` 并返回结果

### Phase D — 文档与质量（持续，穿插在各 Phase 中）

| # | 任务 | 优先级 | 预估 |
|---|------|--------|------|
| D1 | 统一 `docs/` 与 `apps/docs/`，确定单一信息源 | P1 | 6h |
| D2 | 更新 `plugins.md` 对齐 ADR-012 | P1 | 2h |
| D3 | 17 个包补充 README（至少含 usage 示例） | P2 | 8h |
| D4 | ui-react 组件迁移到 `<Input>` / `<Textarea>` | P2 | 4h |
| D5 | Elevation token 全面覆盖（Toolbar、CommandPalette 等） | P2 | 3h |
| D6 | Workspace 添加 React Error Boundary | P2 | 2h |
| D7 | PipelineBar button-in-button 可访问性修复 | P2 | 2h |
| D8 | 性能基线: Lighthouse audit + crash rate 接入 | P2 | 4h |

---

## 6. 风险与依赖

### 6.1 外部依赖

| 依赖 | 风险 | 缓解措施 |
|------|------|----------|
| Vercel 部署配额 | 免费 tier 可能不够 | 提前配置 team plan |
| npm org 权限 | `@lokvis` scope 需确认 | 提前验证 org 设置 |
| Sharp (engine-image) | Native module 跨平台编译 | 已使用 prebuild，需验证 arm64 |

### 6.2 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Plugin sandbox 安全漏洞 | 高 | 中 | CSP + Worker 双重隔离，安全审计 |
| MCP 协议版本变更 | 中 | 低 | 跟踪 MCP spec，预留 adapter 层 |
| Web Worker Blob 传输性能 | 中 | 中 | SharedArrayBuffer fallback |

### 6.3 关键路径

```
A1 (NPM_TOKEN) → A2 (changeset) → A5 (npm publish)
                                        ↓
A3 (Vercel deploy) → A4 (E2E) → Phase B / C 可并行启动
```

Phase B (Plugin SDK) 和 Phase C (MCP Server) 无互相依赖，可以并行推进。但两者都依赖 Phase A 完成（npm publish 后的稳定版本作为 plugin 开发基线）。

---

*本报告基于 `dev` branch commit `19700a4` 的代码分析和 35 篇文档的交叉对比生成。*

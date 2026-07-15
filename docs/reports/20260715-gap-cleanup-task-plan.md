# 架构 Gap 与 Workaround 清理任务清单

- **来源**：2026-07-15 全包审计(基于 docs/ + packages/ + apps/ 精读)
- **目标分支**：`fix/architecture-gap-and-workaround-cleanup` → `dev`
- **执行规则**：每个任务独立 commit,单任务完成后立即 push,统一合并到同一个 PR
- **审计基线**：dev @ `3309215 fix: review 反馈修复 — 消除所有 workaround 实现`

---

## 审计结论摘要

| 维度 | 评分 | 说明 |
|---|---|---|
| 五层架构依赖 | 9/10 | UI→Workflow→Runtime→Capability→Engine 单向依赖零违规;Workflow 已独立成包 |
| God Object 拆解 | 9/10 | runtime.ts 22 行,runtime-impl.ts 218 行,5 个 manager 抽出 |
| Capability 单一信息源 | 8/10 | ADR-013 codegen 已落地,但 `CAPABILITY_NAMES` 常量与 generated 联合类型仍有重复(ADR-013 接受) |
| Stub Engine 标准 | 9/10 | 4 个 stub engine 全部符合 AGENTS.md 三标准 |
| 文档与代码一致性 | 5/10 | 16 项不一致(4 高/8 中/4 低) |
| Workaround 登记 | 5/10 | 5 处生产代码 workaround/双断言未在 technical-debt.md 登记 |

**核心问题**:
1. 5 处生产代码 workaround/双断言未登记(plugin-permissions ×3、mcp-server sharp 直用、SDK message 匹配)
2. 文档与代码状态严重漂移(ADR-013 仍 Proposed、诊断报告 P0/P1 状态未更新、SDK 错误类名错误、MCP 文档过度承诺)
3. mcp-server 架构定位模糊(绕过 Capability 层直接用 sharp,与 ADR-011 设计意图偏离)

---

## 任务列表

### T0 — 任务规划文档(本文件)

- **状态**:进行中
- **交付**:`docs/reports/20260715-gap-cleanup-task-plan.md`
- **commit message**:`docs: 架构 gap 与 workaround 清理任务清单`

### T1 — ADR-013 状态升级 Proposed → Accepted

- **问题**:ADR-013 仍标记 Proposed,但 manifest codegen 系统已完整落地(5 域 manifest + codegen 脚本 + 5 个 .generated.ts + capability-names.generated.ts)
- **文件**:
  - `docs/adr/013-capability-manifest.md`(状态字段)
  - `docs/adr/README.md`(索引表状态列)
- **commit message**:`docs(adr): ADR-013 状态升级 Proposed → Accepted(manifest 已落地)`
- **状态**:待办

### T2 — sdk-reference.md 公共契约级修正

- **问题**:三个错误类名与代码不符,消费方 `instanceof` 永不命中
- **文件**:`docs/sdk-reference.md`
- **修正项**:
  1. 错误类名:`QuotaExceededError` → `StorageQuotaExceededError`
  2. 错误类名:`CapabilityNotFoundError` → `CapabilityNotRegisteredError`
  3. 错误类名:`WorkflowValidationError` → `WorkflowInvalidError`
  4. `cancel(workflowId)` 返回类型 `void` → `Promise<void>`
  5. Runtime API 表格补齐缺失方法(pause/resume/disposeWorkflow/history/getHistoryState/jumpTo/hasCapability/isStubOnly/getStorageUsage/readAssetExif)
  6. 错误类型清单补全遗漏类(StorageOpfsUnavailableError / WorkerCrashedError / WorkerTimeoutError / WorkerDeadError / WorkerRequestAbortedError / WorkerHandshakeError / DegradationRejectedError / PluginLoadError 等)
- **commit message**:`docs(sdk): 修正错误类名与 Runtime API 表格(公共契约级)`
- **状态**:待办

### T3 — workflows.md 与 architecture.md 文档修正

- **问题**:
  - `workflows.md:94` `import { WorkflowBuilder } from '@lokvis/runtime'` — runtime 已不导出 WorkflowBuilder,应从 `@lokvis/workflow` 导入
  - `architecture.md §5` run() 流程描述缺失 `validateWorkflow(maxSteps, resolveCapability)` 步骤
  - `architecture.md §8` 仓库基线状态滞后(plugin-image 8→9 能力、mcp-server 骨架→已实装、playground 占位→已落地)
- **文件**:
  - `docs/workflows.md`
  - `docs/architecture.md`
- **commit message**:`docs: 修正 WorkflowBuilder 导入路径与 architecture 基线状态`
- **状态**:待办

### T4 — mcp-integration.md 顶部加进度徽章 + 7→5 tool 修正

- **问题**:mcp-integration.md 描述"完整 MCP 能力提供方"愿景(tools + resources + prompts 三层),实际仅 tools 层 5 个实现
- **文件**:`docs/mcp-integration.md`
- **修正项**:
  1. 顶部加"当前实现进度"徽章(仅 tools 层 5 个,无 meta tools/resources/prompts)
  2. 能力 Tool 表 7→5(删除 `image.crop`、`image.watermark` 两行,标注未实现)
  3. Meta Tools / Resources / Prompts 章节加"未实现"标记
  4. §11 包结构图修正(删除不存在的 workflow.ts/asset.ts/resources/prompts/adapters 目录)
- **commit message**:`docs(mcp): 顶部加进度徽章,修正 tool 清单与包结构图`
- **状态**:待办

### T5 — technical-debt.md 全面更新

- **问题**:TD 文档与代码状态严重漂移
- **文件**:`docs/technical-debt.md`
- **修正项**:
  1. **登记新 TD**:
     - TD-4.5 `runtime/src/plugin-permissions.ts:186/196/209` 三处 `as unknown as` 全局构造器/原型方法 monkey-patch 跨边界断言
     - TD-1.3 `mcp-server/src/tools/image.ts` 直接用 sharp 绕过 engine-image-node(注释自认过渡)
     - TD-1.4 `mcp-server/src/tools/pdf.ts` 直接用 pdf-lib 绕过 engine-pdf
     - TD-x `sdk/src/errors.ts:361-389` best-effort message 模式匹配过渡方案
     - TD-3.5 `runtime/src/batch-progress.ts:100-105` 进度订阅者静默吞错
     - TD-3.6 `runtime/src/batch-progress.ts:219-225` EventBus.emit 静默吞错
     - TD-3.7 `runtime/src/batch-processor.ts:156-160` BatchProcessor.cancel 单项 cancel 静默吞错
     - TD-3.8 `runtime/src/history.ts:189-195` onEvict 同步异常静默吞错
     - TD-3.9 `runtime/src/asset-store.ts:104-117` 富元数据失败静默降级
     - TD-3.10 `runtime/src/opfs-asset-store.ts:231-237` catch+rethrow 丢上下文
     - TD-x `mcp-server` 6 处 `.catch(() => {})`(sse-transport.ts/cli.ts/node-asset-store.ts)
  2. **同步已修复状态**:
     - TD-3.1 / 3.2 / 3.3:已加 warn(不区分错误类型),TD-3.3 文件位置更新为 `batch-scheduler.ts:124,162,172`
     - TD-4.1(dialog.tsx 双断言):代码已清偿,移到「已清偿」章节
     - TD-4.3(CLI 手写 type guard):代码已清偿,移到「已清偿」章节
     - TD-4.2 行号修正:205 → 237
  3. **同步 cloud 耦合登记**:mcp-server auth.ts/billing.ts 硬编码 cloud URL/plan 名
- **commit message**:`docs(td): 登记新 workaround + 同步已清偿债务状态`
- **状态**:待办

### T6 — architecture-deep-diagnostic 状态更新

- **问题**:诊断报告 §3 P0/P1 状态表未更新,P0-1/P1-5/P1-6/P1-7/P1-8 已修复但仍列为活动问题
- **文件**:`docs/reports/architecture-deep-diagnostic-20260712.md`
- **修正项**:在 §3 表格后追加"Review #4 — 2026-07-15 状态复核"小节,标注 P0-1/P1-5/P1-6/P1-7/P1-8 已修复
- **commit message**:`docs(report): 诊断报告 P0/P1 状态复核(MCP/God Object/Workflow/Manifest 已修复)`
- **状态**:待办

### T7 — mcp-server stale 注释修正

- **问题**:server.ts/router.ts 注释说"Phase 2 骨架",但代码已实装
- **文件**:
  - `packages/mcp-server/src/server.ts:22-23`
  - `packages/mcp-server/src/router.ts:11-12`
- **commit message**:`fix(mcp): 修正 stale 注释(server/router 已实装非骨架)`
- **状态**:待办

### T8 — 消除 plugin-permissions.ts 三处 `as unknown as` 双断言

- **问题**:[AGENTS.md](../../AGENTS.md) 明文禁止 `as unknown as` 双断言(Worker scope 是唯一明文例外)。`plugin-permissions.ts` 三处用于 monkey-patch 全局构造器/原型方法,属未登记的违规 workaround
- **文件**:`packages/runtime/src/plugin-permissions.ts:186/196/209`
- **方案**:用类型安全的方式重写 monkey-patch。三种思路:
  1. 用 `Function.prototype` 的合法子类化(对 WebSocket/EventSource 构造器)
  2. 用 `declare global` 扩展原生类型,提供类型友好的 patch 接口
  3. 用 `Object.defineProperty` 替代直接赋值
- **验收**:三处双断言消除;`pnpm test --filter @lokvis/runtime` 全绿;`plugin-permissions.test.ts` 验证沙箱生效
- **commit message**:`refactor(runtime): 消除 plugin-permissions.ts 三处 as unknown as 双断言`
- **状态**:待办

### T9 — mcp-server 改为经 plugin-image/node + plugin-pdf/node + runtime capability 系统调用

- **问题**:`mcp-server/src/tools/image.ts` 直接 `import sharp from 'sharp'`,`tools/pdf.ts` 直接 `import { PDFDocument } from 'pdf-lib'`,绕过 Engine 层与 ADR-011 设计意图(注释自认过渡方案)
- **文件**:
  - `packages/mcp-server/src/tools/image.ts`
  - `packages/mcp-server/src/tools/pdf.ts`
  - `packages/mcp-server/package.json`(新增 `@lokvis/plugin-image`、`@lokvis/plugin-pdf` 依赖,或经 `@lokvis/engine-image-node` + `engine-pdf`)
  - 可能需要新增 `plugin-pdf/node-plugin.ts`(目前 plugin-pdf 只有浏览器版 stub)
- **方案**:
  - image tool handlers 改为经 `runtime.capabilities.execute('image.resize', ...)` 或直接经 `plugin-image/node` 的 capability impl 调用
  - pdf tool handlers 同理(但 engine-pdf 是 stub,需要先实装 engine-pdf 用 pdf-lib,或直接调 pdf-lib 但经 engine-pdf 包)
  - **取舍**:engine-pdf 当前是 stub,本任务范围内不动 stub 状态;pdf tool 可改为经 `engine-pdf` 暴露的 Blob↔Blob API(需 engine-pdf 先实装 merge/compress),或者维持直用 pdf-lib 但移到 `engine-pdf/src` 内(mcp-server 改为经 engine-pdf 调用)
  - **简化方案(本任务采用)**:
    - image:改为经 `@lokvis/plugin-image/node` 的 capability implementation,通过 runtime capability 系统调用
    - pdf:把 pdf-lib 调用迁移到 `engine-pdf` 包,实装 `merge`/`compress` 两个 Blob↔Blob 操作;mcp-server 经 runtime capability 系统调用
- **验收**:
  - mcp-server/src/tools/image.ts 不再直接 import sharp
  - mcp-server/src/tools/pdf.ts 不再直接 import pdf-lib
  - `pnpm test --filter @lokvis/mcp-server` 全绿
  - `pnpm test --filter @lokvis/engine-pdf` 全绿(若 engine-pdf 实装)
  - `pnpm test --filter @lokvis/plugin-image` 全绿
- **commit message**:`refactor(mcp): image/pdf tool 改为经 runtime capability 系统调用(消除 sharp/pdf-lib 直用)`
- **状态**:待办
- **风险**:本任务改动面大,需谨慎设计。若复杂度过高,可拆为 T9a(image)与 T9b(pdf)两个子任务

### T10 — SDK errors.ts message 匹配 → runtime 抛类型化错误

- **问题**:`sdk/src/errors.ts:361-389` 用 `msg.startsWith('Asset not found')` 等 message 模式匹配恢复类型,注释自认过渡方案。runtime message 文案变更会让 SDK 静默退化为 `LokvisError({ code: 'UNKNOWN' })`
- **文件**:
  - `packages/runtime/src/`(各抛错点改用类型化错误类)
  - `packages/sdk/src/errors.ts`(移除 message 匹配兜底,改为 `instanceof` 检测)
  - 可能需要把 SDK 错误类下沉到 `@lokvis/schema` 或新增 `@lokvis/errors` 包,避免 runtime → sdk 反向依赖
- **方案**:
  1. **方案 A(推荐)**:在 `@lokvis/schema` 新增 `errors.ts` 定义类型化错误基类(`AssetNotFoundError`、`WorkflowInvalidError`、`CapabilityNotRegisteredError` 等),runtime 与 sdk 都从 schema import
  2. **方案 B**:在 `@lokvis/runtime` 暴露 `RuntimeError` 类型化错误类,sdk 经 `instanceof` 检测(需 sdk 依赖 runtime 的 errors 子路径)
  3. **方案 C(最小改动)**:runtime 在抛错点用 `Error` 子类 + `name` 字段标识,SDK 用 `err.name === 'AssetNotFound'` 检测(比 message 模式匹配稳定)
- **验收**:
  - `sdk/src/errors.ts` 删除 message 模式匹配分支
  - runtime 各抛错点改用类型化错误
  - `pnpm test --filter @lokvis/runtime` 全绿
  - `pnpm test --filter @lokvis/sdk` 全绿
  - 全量 `pnpm typecheck` 通过
- **commit message**:`refactor(errors): runtime 抛类型化错误,SDK 移除 message 模式匹配`
- **状态**:待办
- **风险**:涉及 runtime 多处抛错点;需保证 SDK 错误类名向后兼容(已有的 StorageQuotaExceededError 等不变)

---

## 执行顺序与依赖

```
T0(本文档)
  ↓
T1(ADR-013) ─┐
T2(SDK doc)  ─┤  纯文档,可并行
T3(workflow/arch doc) ─┤
T4(mcp doc)  ─┤
T5(TD doc)   ─┤
T6(diagnostic) ─┘
  ↓
T7(stale 注释)  小代码改动
  ↓
T8(plugin-permissions 双断言)  代码重构,独立
  ↓
T9(mcp 经 capability)  大改动,依赖 T7 后的 mcp-server
  ↓
T10(SDK errors)  代码重构,涉及 runtime 多处
  ↓
PR → dev
```

---

## 验收门禁

- [ ] 所有 10 个任务 commit 完成
- [ ] `pnpm typecheck` 0 errors
- [ ] `pnpm test` 全绿(无新增 flaky)
- [ ] `pnpm build` 全部任务通过
- [ ] `docs/technical-debt.md` 与代码状态一致
- [ ] `docs/adr/` 状态与代码一致
- [ ] 生产代码无未登记的 `as unknown as` 双断言(除 Worker scope 明文例外)
- [ ] 生产代码无未登记的 sharp/pdf-lib 直用(mcp-server 经 capability 系统)

---

## 不在本 PR 范围

- mcp-server meta tools / resources / prompts 实施(属 Phase 2 W7-W10 路线)
- mcp-server cloud 配置抽取(独立改造,可单独 PR)
- engine-pdf / engine-video / engine-audio / engine-ai 实装(Phase 2 路线)
- CAPABILITY_NAMES 常量对象消除(ADR-013 已接受的权衡)
- 提取共享 `IMAGE_CAPABILITY_NAMES` 消除字面量重复(小重构,可单独 PR)

---

*本任务清单源自 2026-07-15 全包审计,审计基线见 `docs/reports/architecture-deep-diagnostic-20260712.md` 与本 PR 各任务 commit。*

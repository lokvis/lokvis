# ADR-014：plugin-dev 跨 Engine 层访问 ctx.runtime.\* 的例外

- **状态**：Accepted
- **日期**：2026-07-18
- **来源**：[Phase 2-4 任务计划](../reports/20260718-phase2-4-task-plan.md) O-18

---

## 背景

AGENTS.md 定义五层架构单向依赖：

```
UI → Workflow → Runtime → Capability → Engine
```

Engine 层只暴露 Blob↔Blob 纯函数，Capability 层（plugin-\*）是 Engine 与
Runtime 的桥梁。正常情况下，plugin 通过 `ctx.registerCapability()` 注册
`CapabilityImplementation`，impl 内部调用 Engine 层的 Blob 操作。

`@lokvis/plugin-dev` 是开发者工具插件，提供 4 个能力：

- `developer.inspect.capabilities` — 列出所有已注册能力
- `developer.inspect.asset` — 检视资产元数据与结构
- `developer.validate.workflow` — 校验 Workflow 定义（不执行）
- `developer.profile` — 能力执行耗时剖析

这些能力的实现直接调用了 `ctx.runtime.*`：

| 文件 | 调用 | 用途 |
|------|------|------|
| `capabilities/inspect-capabilities.ts` | `ctx.runtime.listCapabilities()` | 列出已注册能力 |
| `capabilities/profile.ts` | `ctx.runtime.getAssetBlob(asset)` | 读取资产 Blob 用于剖析 |
| `capabilities/shared.ts` | `ctx.runtime.createAsset(blob, metadata, 'data')` | 创建 JSON 资产输出 |

从五层架构看，plugin（Capability 层）直接调用 `ctx.runtime.*`（Runtime 层）
似乎违反了「Capability 层是 Engine 与 Runtime 的桥梁」定位 —— 它绕过了
Engine 层，直接访问 Runtime 的 API。

## 决策

**维持现状，正式登记为例外。**

`plugin-dev` 的能力本质是 **Runtime 内省（introspection）**，不是
Blob↔Blob 的数据处理。其能力实现直接访问 Runtime API 是合理的：

1. **能力语义不同**：inspect/profile 类能力的目标是读取 Runtime 状态
   （已注册能力列表、资产元数据），而不是对 Blob 做变换。这类能力
   没有对应的 Engine 层操作可调用。

2. **无 Engine 层对应**：`listCapabilities()` / `getAssetBlob()` /
   `createAsset()` 是 Runtime 层的管理 API，Engine 层不提供这些功能
   （Engine 层只处理 Blob↔Blob）。

3. **PluginContext 设计意图**：`ctx.runtime` 在 PluginContext 中暴露
   正是为了让 plugin 能访问 Runtime 状态。plugin-dev 作为开发者工具，
   是 `ctx.runtime` 的合法消费者。

4. **与数据流 plugin 的区别**：image/pdf/video 等 plugin 走
   Engine→Capability 路径处理 Blob，plugin-dev 走 Runtime 内省路径
   读取状态。两者是不同的 plugin 形态，五层架构不应强行统一。

## 例外边界

此例外**仅适用于**：

- `@lokvis/plugin-dev`（开发者工具插件）
- 未来同类**内省/诊断**类 plugin（如审计、监控插件）

**不适用于**数据处理类 plugin（image/pdf/video/audio/ai），这些 plugin
必须走 Engine→Capability 路径，不得直接调用 `ctx.runtime.*` 绕过
Engine 层。

## 验证

- ✅ `plugin-dev/src/capabilities/` 4 个能力实现均只调用 `ctx.runtime`
  的只读/管理 API（listCapabilities / getAssetBlob / createAsset）
- ✅ 不调用任何 Engine 层包（plugin-dev 无 `@lokvis/engine-*` 依赖）
- ✅ `ctx.runtime` 访问限定在 plugin-dev 包内，不扩散到其他 plugin

## 后续

- 若未来出现更多内省类 plugin，考虑抽取 `@lokvis/plugin-introspection`
  共享包，集中管理 `ctx.runtime` 访问模式
- Market（Phase 3）plugin 审核流程应明确区分「数据处理 plugin」与
  「内省 plugin」，后者需额外审核 `ctx.runtime` 访问范围

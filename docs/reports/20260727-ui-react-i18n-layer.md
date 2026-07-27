# ui-react i18n 层（2026-07-27）

> **状态：⏭️ 延后**（0.5.6 发布后独立排期）
>
> 来源：`customization-gap-analysis.md` 修复顺序第 6 项（P2-P3，按需）中的「ui-react i18n 层」。同项的另外两项——**plugin:loaded 订阅**（runtime-slice `pluginSub`）与 **capability presentation 元数据**（schema `label`/`icon`/`group` + Inspector/CommandPalette/WorkflowEditor 消费）——已在 0.5.6 实现。i18n 层因规模为独立 feature 级（非缺口修复），从本轮发布剥离，立此任务文档。

## 一、背景

Workspace 及其 24 个组件内英文/中文混合硬编码（Inspector 'Capabilities'/'Search capabilities...'、WorkflowEditor '搜索 capability...'、CommandPalette 'No matching commands' 等），三方无法切换语言。embed-image 已有成熟模式（`EmbedI18nProvider` + `useLang(locale)` 优先级链 + `t()` overrides 链 + 6 语言字典），ui-react 没有对应物。

## 二、任务字段

- **范围**：
  1. i18n 基建：字典（ui.ts 模式，6 语言）+ `WorkspaceI18nProvider` + `useWorkspaceLang(locale)` / `useWorkspaceTranslations()`，优先级链复用 embed-image 设计（显式 prop > Provider > `document.documentElement.lang` > URL 前缀）。
  2. 24 个组件 + Workspace 外壳的硬编码字符串接线（约 100+ 条，含 aria-label / placeholder / title）。
  3. **store 侧消息**：`statusMessage`（'Importing N file(s)...' 等）与 store 内构造的文案也在范围内——这是与 embed-image 纯组件文案的关键差异，需要「消息 key + 参数」而非纯字符串字典。
  4. 测试：字典 6 语言完整性 + 组件 locale 渲染 + Provider 注入。
- **不做**：运行时语言切换器 UI（三方可自建，Provider 已足够）；SSR locale 协商（ui-react 为 client-only island）；embed-image 字典与 ui-react 字典合并（两包独立演进，key 命名空间隔离）。
- **输入**：gap 分析 §P2-6；embed-image `src/i18n/*` 现成实现（可整体移植适配）。
- **输出**：`packages/ui-react/src/i18n/`（config / ui / provider / hooks）；24 组件接线 diff；测试；ui-react README i18n 接入段落。
- **依赖**：无硬依赖。与 capability presentation 元数据正交（label 是 capability 自带展示名，i18n 是 UI  chrome 文案）。
- **验收**：`<Workspace locale="zh">` 全 UI 无英文硬编码残留（grep 门禁）；默认行为不变（不传 locale 时与现状一致）；vitest + tsc + oxlint 0 error。
- **估时**：10-14h（字典抽取 4h、接线 5-6h、store 消息参数化 2h、测试 2h）。
- **风险**：store 消息参数化改动面大（statusMessage 被多处 `setStatus()` 写入，需统一改为 key+params）；接线期间 UI 快照类测试需同步更新。
- **优先级**：P2（体验缺口，非正确性/诚信问题，不阻塞三方——三方可完全自建 UI 绕过）。
